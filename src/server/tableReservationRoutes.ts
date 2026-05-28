import type { Express, Request, Response } from "express";
import type { Prisma, TableReservationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import { businessTypeSupportsTableReservations } from "../shared/tableReservation.js";
import {
  CreateTableReservationSchema,
  PatchTableReservationSchema,
  TableSlotsQuerySchema,
} from "../shared/tableReservationSchema.js";
import {
  computeDisplayStatus,
  filterAvailableSlots,
  hasReservationConflict,
  isTableBookable,
  loadActiveReservations,
  parseReservedAtIso,
  syncDiningTableStatuses,
} from "./tableReservationService.js";
import {
  notifyReservationCancelled,
  notifyReservationConfirmed,
} from "./tableReservationNotify.js";

type Deps = {
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<{ businessId: number } | null>;
  telegramIdFromRequest: (req: Request) => string | null;
};

const VENUE_DENIED = "Бронирование столиков недоступно для этого типа магазина.";

function parseBusinessId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function parseReservationId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function assertVenueBusiness(businessId: number): Promise<boolean> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true, isActive: true, isBlocked: true },
  });
  if (!b || !b.isActive || b.isBlocked) return false;
  return businessTypeSupportsTableReservations(b.businessType);
}

function tablePublicDto(
  row: {
    id: number;
    name: string;
    seats: number;
    shape: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    status: string;
  },
  displayStatus: string,
  bookable: boolean,
  nextReservation: { reservedAt: Date } | null,
) {
  return {
    id: row.id,
    name: row.name,
    seats: row.seats,
    shape: row.shape,
    posX: row.posX,
    posY: row.posY,
    width: row.width,
    height: row.height,
    status: displayStatus,
    bookable,
    nextReservation: nextReservation
      ? { reservedAt: nextReservation.reservedAt.toISOString() }
      : null,
  };
}

function reservationDto(row: {
  id: number;
  tableId: number;
  reservedAt: Date;
  partySize: number | null;
  guestName: string | null;
  guestPhone: string | null;
  guestNote: string | null;
  status: TableReservationStatus;
  durationMinutes: number;
  createdAt: Date;
  table?: { name: string; seats: number };
}) {
  return {
    id: row.id,
    tableId: row.tableId,
    tableName: row.table?.name ?? null,
    tableSeats: row.table?.seats ?? null,
    reservedAt: row.reservedAt.toISOString(),
    partySize: row.partySize,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    guestNote: row.guestNote,
    status: row.status,
    durationMinutes: row.durationMinutes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function attachTableReservationRoutes(app: Express, deps: Deps): void {
  const { requireMerchantStaff, telegramIdFromRequest } = deps;

  app.get("/api/storefront/:businessId/dining-tables", async (req: Request, res: Response) => {
    try {
      const businessId = parseBusinessId(req.params.businessId);
      if (businessId == null) {
        res.status(400).json({ error: "Некорректный магазин" });
        return;
      }
      if (!(await assertVenueBusiness(businessId))) {
        res.json({ supported: false, tables: [] });
        return;
      }

      const tables = await prisma.diningTable.findMany({
        where: { businessId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      const reservations = await loadActiveReservations(businessId);
      const byTable = new Map<number, typeof reservations>();
      for (const r of reservations) {
        const list = byTable.get(r.tableId) ?? [];
        list.push(r);
        byTable.set(r.tableId, list);
      }
      const now = new Date();

      res.json({
        supported: true,
        tables: tables.map((t) => {
          const tableRes = byTable.get(t.id) ?? [];
          const display = computeDisplayStatus(t.status, tableRes, now);
          const next = tableRes.find((r) => r.reservedAt >= now) ?? null;
          return tablePublicDto(t, display, isTableBookable(display), next);
        }),
      });
    } catch (e) {
      console.error("GET storefront dining-tables:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.get(
    "/api/storefront/:businessId/dining-tables/slots",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        if (businessId == null) {
          res.status(400).json({ error: "Некорректный магазин" });
          return;
        }
        if (!(await assertVenueBusiness(businessId))) {
          res.status(403).json({ error: VENUE_DENIED });
          return;
        }

        const parsed = TableSlotsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          res.status(400).json({ error: "Укажите tableId и date (YYYY-MM-DD)" });
          return;
        }

        const table = await prisma.diningTable.findFirst({
          where: { id: parsed.data.tableId, businessId, isActive: true },
        });
        if (!table) {
          res.status(404).json({ error: "Столик не найден" });
          return;
        }

        const reservations = await prisma.tableReservation.findMany({
          where: {
            businessId,
            tableId: table.id,
            status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
          },
          select: {
            id: true,
            tableId: true,
            reservedAt: true,
            durationMinutes: true,
            status: true,
          },
        });

        const slots = filterAvailableSlots(
          parsed.data.date,
          reservations,
          90,
        );

        res.json({ slots, durationMinutes: 90 });
      } catch (e) {
        console.error("GET dining-tables/slots:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/table-reservations",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        if (businessId == null) {
          res.status(400).json({ error: "Некорректный магазин" });
          return;
        }
        const telegramId = telegramIdFromRequest(req);
        if (!telegramId) {
          res.status(401).json({ error: "Откройте Mini App через Telegram" });
          return;
        }
        if (!(await assertVenueBusiness(businessId))) {
          res.status(403).json({ error: VENUE_DENIED });
          return;
        }

        const parsed = CreateTableReservationSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.flatten().formErrors.join("; ") || "Некорректные данные",
          });
          return;
        }

        const reservedAt = parseReservedAtIso(parsed.data.reservedAt);
        if (!reservedAt || reservedAt.getTime() <= Date.now()) {
          res.status(400).json({ error: "Выберите будущее время" });
          return;
        }

        const durationMinutes = parsed.data.durationMinutes ?? 90;

        const table = await prisma.diningTable.findFirst({
          where: { id: parsed.data.tableId, businessId, isActive: true },
        });
        if (!table) {
          res.status(404).json({ error: "Столик не найден" });
          return;
        }

        if (parsed.data.partySize > table.seats) {
          res.status(400).json({
            error: `На этом столике максимум ${table.seats} гостей`,
          });
          return;
        }

        const conflict = await hasReservationConflict(
          businessId,
          table.id,
          reservedAt,
          durationMinutes,
        );
        if (conflict) {
          res.status(409).json({ error: "Это время уже занято. Выберите другой слот." });
          return;
        }

        const business = await prisma.business.findUnique({
          where: { id: businessId },
          select: { name: true },
        });

        const created = await prisma.tableReservation.create({
          data: {
            businessId,
            tableId: table.id,
            reservedAt,
            partySize: parsed.data.partySize,
            guestName: parsed.data.guestName,
            guestPhone: parsed.data.guestPhone,
            guestNote: parsed.data.guestNote ?? null,
            durationMinutes,
            guestTelegramId: telegramId,
            status: "CONFIRMED",
          },
          include: { table: { select: { name: true, seats: true } } },
        });

        await syncDiningTableStatuses(businessId);

        void notifyReservationConfirmed({
          businessId,
          businessName: business?.name ?? "Кафе",
          guestTelegramId: telegramId,
          tableName: table.name,
          reservedAt,
          partySize: parsed.data.partySize,
        });

        res.status(201).json({ reservation: reservationDto(created) });
      } catch (e) {
        console.error("POST table-reservations:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.get("/api/merchant/table-reservations", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED, supported: false });
        return;
      }

      const filter = String(req.query.filter ?? "upcoming");
      const now = new Date();

      let where: Prisma.TableReservationWhereInput = {
        businessId: merchant.businessId,
      };

      if (filter === "active") {
        where = {
          businessId: merchant.businessId,
          status: { in: ["CONFIRMED", "ARRIVED"] },
          reservedAt: { lte: new Date(now.getTime() + 90 * 60_000) },
        };
      } else if (filter === "cancelled") {
        where = {
          businessId: merchant.businessId,
          status: { in: ["CANCELLED", "NO_SHOW"] },
        };
      } else if (filter === "completed") {
        where = {
          businessId: merchant.businessId,
          status: "COMPLETED",
        };
      } else {
        where = {
          businessId: merchant.businessId,
          status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
          reservedAt: { gte: now },
        };
      }

      const rows = await prisma.tableReservation.findMany({
        where,
        include: { table: { select: { name: true, seats: true } } },
        orderBy: { reservedAt: "asc" },
        take: 100,
      });

      res.json({
        supported: true,
        reservations: rows.map(reservationDto),
      });
    } catch (e) {
      console.error("GET merchant table-reservations:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.patch(
    "/api/merchant/table-reservations/:id",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
        if (!merchant) return;
        if (!(await assertVenueBusiness(merchant.businessId))) {
          res.status(403).json({ error: VENUE_DENIED });
          return;
        }

        const id = parseReservationId(req.params.id);
        if (id == null) {
          res.status(400).json({ error: "Некорректный id" });
          return;
        }

        const parsed = PatchTableReservationSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Укажите status" });
          return;
        }

        const existing = await prisma.tableReservation.findFirst({
          where: { id, businessId: merchant.businessId },
          include: {
            table: { select: { name: true } },
            business: { select: { name: true } },
          },
        });
        if (!existing) {
          res.status(404).json({ error: "Бронь не найдена" });
          return;
        }

        const nextStatus = parsed.data.status;
        const data: {
          status: TableReservationStatus;
          cancelledAt?: Date;
        } = { status: nextStatus };
        if (nextStatus === "CANCELLED" || nextStatus === "NO_SHOW") {
          data.cancelledAt = new Date();
        }

        const updated = await prisma.tableReservation.update({
          where: { id },
          data,
          include: { table: { select: { name: true, seats: true } } },
        });

        await syncDiningTableStatuses(merchant.businessId);

        if (
          (nextStatus === "CANCELLED" || nextStatus === "NO_SHOW") &&
          existing.guestTelegramId
        ) {
          void notifyReservationCancelled({
            businessId: merchant.businessId,
            businessName: existing.business.name,
            guestTelegramId: existing.guestTelegramId,
            tableName: existing.table.name,
            reservedAt: existing.reservedAt,
          });
        }

        if (nextStatus === "CONFIRMED" && existing.guestTelegramId) {
          void notifyReservationConfirmed({
            businessId: merchant.businessId,
            businessName: existing.business.name,
            guestTelegramId: existing.guestTelegramId,
            tableName: existing.table.name,
            reservedAt: existing.reservedAt,
            partySize: existing.partySize ?? 1,
          });
        }

        res.json({ reservation: reservationDto(updated) });
      } catch (e) {
        console.error("PATCH table-reservations:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );
}
