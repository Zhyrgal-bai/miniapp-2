import type { Express, Request, Response } from "express";
import type { Prisma, TableReservationStatus, ReservationDepositStatus } from "@prisma/client";
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
import type { TableLiveStatus } from "@prisma/client";
import {
  filterAvailableSlots,
  hasReservationConflict,
  isTableBookableLive,
  loadActiveReservations,
  parseReservedAtIso,
  syncDiningTableStatuses,
} from "./tableReservationService.js";
import {
  confirmTableReservationById,
} from "./tableReservationApproval.js";
import {
  assertReservationPreorderEligible,
  cancelUnpaidPreordersForReservation,
  loadReservationPreorderSummaries,
  type ReservationPreorderSummary,
} from "./tableReservationPreorder.js";
import {
  notifyOwnerNewReservation,
  notifyReservationCancelled,
} from "./tableReservationNotify.js";
import {
  reservationDepositDtoFields,
  startReservationDepositPayment,
  syncGuestReservationDepositPayment,
} from "./tableReservationDeposit.js";
import {
  businessSubscriptionGateSelect,
  canAcceptCustomerOrders,
} from "./subscriptionAccess.js";

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
    select: {
      ...businessSubscriptionGateSelect,
      businessType: true,
    },
  });
  if (!b || !canAcceptCustomerOrders(b)) return false;
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
    liveStatus: TableLiveStatus;
  },
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
    status: row.liveStatus,
    bookable,
    nextReservation: nextReservation
      ? { reservedAt: nextReservation.reservedAt.toISOString() }
      : null,
  };
}

function reservationDto(
  row: {
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
    depositStatus?: ReservationDepositStatus;
    depositAmount?: number | null;
    depositPaidAt?: Date | null;
    depositDueAt?: Date | null;
    table?: { name: string; seats: number };
  },
  extra?: { preorderSummary?: ReservationPreorderSummary },
) {
  const depositFields =
    row.depositStatus != null
      ? reservationDepositDtoFields({
          depositStatus: row.depositStatus,
          depositAmount: row.depositAmount ?? null,
          depositPaidAt: row.depositPaidAt ?? null,
          depositDueAt: row.depositDueAt ?? null,
        })
      : {
          depositStatus: "NONE" as const,
          depositAmount: null,
          depositPaidAt: null,
          depositDueAt: null,
          depositLabel: "Не требуется",
          canPayDeposit: false,
        };

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
    hasPreorder: extra?.preorderSummary?.hasPaidPreorder ?? false,
    preorderStatus: extra?.preorderSummary?.guestStatus ?? "none",
    preorderLabel: extra?.preorderSummary?.label ?? "Нет предзаказа",
    ...depositFields,
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
        console.warn("[storefront/dining-tables] venue not supported", { businessId });
        res.json({ supported: false, tables: [] });
        return;
      }

      const tables = await prisma.diningTable.findMany({
        where: { businessId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      let reservations: Awaited<ReturnType<typeof loadActiveReservations>> = [];
      try {
        reservations = await loadActiveReservations(businessId);
      } catch (resErr) {
        console.error(
          "[storefront/dining-tables] loadActiveReservations failed — falling back to PENDING/CONFIRMED only:",
          resErr,
        );
        reservations = await prisma.tableReservation.findMany({
          where: {
            businessId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          select: {
            id: true,
            tableId: true,
            reservedAt: true,
            durationMinutes: true,
            status: true,
          },
          orderBy: { reservedAt: "asc" },
        });
      }

      const byTable = new Map<number, typeof reservations>();
      for (const r of reservations) {
        const list = byTable.get(r.tableId) ?? [];
        list.push(r);
        byTable.set(r.tableId, list);
      }
      const now = new Date();

      const payload = tables.map((t) => {
        const tableRes = byTable.get(t.id) ?? [];
        const next = tableRes.find((r) => r.reservedAt >= now) ?? null;
        const bookable = isTableBookableLive(t.liveStatus);
        return tablePublicDto(t, bookable, next);
      });

      console.info("[storefront/dining-tables]", {
        businessId,
        tableCount: payload.length,
        tableIds: payload.map((x) => x.id),
        statuses: payload.map((x) => ({ id: x.id, status: x.status, bookable: x.bookable })),
        coords: payload.map((x) => ({
          id: x.id,
          posX: x.posX,
          posY: x.posY,
          width: x.width,
          height: x.height,
        })),
      });

      res.json({
        supported: true,
        tables: payload,
        hasBookableTables: payload.some((t) => t.bookable),
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
            status: "PENDING",
          },
          include: { table: { select: { name: true, seats: true } } },
        });

        await syncDiningTableStatuses(businessId);

        void notifyOwnerNewReservation({
          reservationId: created.id,
          businessId,
          businessName: business?.name ?? "Кафе",
          guestName: parsed.data.guestName,
          guestPhone: parsed.data.guestPhone,
          tableName: table.name,
          partySize: parsed.data.partySize,
          reservedAt,
          guestNote: parsed.data.guestNote ?? null,
        });

        res.status(201).json({ reservation: reservationDto(created) });
      } catch (e) {
        console.error("POST table-reservations:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.get(
    "/api/storefront/:businessId/table-reservations/mine",
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
          res.json({ supported: false, reservations: [] });
          return;
        }

        const rows = await prisma.tableReservation.findMany({
          where: { businessId, guestTelegramId: telegramId },
          include: { table: { select: { name: true, seats: true } } },
          orderBy: { reservedAt: "desc" },
          take: 30,
        });

        const summaries = await loadReservationPreorderSummaries(rows.map((r) => r.id));

        res.json({
          supported: true,
          reservations: rows.map((r) => {
            const summary = summaries.get(r.id);
            return reservationDto(r, summary ? { preorderSummary: summary } : undefined);
          }),
        });
      } catch (e) {
        console.error("GET table-reservations/mine:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.get(
    "/api/storefront/:businessId/table-reservations/:id/preorder-context",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        const reservationId = parseReservationId(req.params.id);
        if (businessId == null || reservationId == null) {
          res.status(400).json({ error: "Некорректные параметры" });
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

        const check = await assertReservationPreorderEligible({
          businessId,
          reservationId,
          guestTelegramId: telegramId,
        });
        if (!check.ok) {
          res.status(check.status).json({ error: check.error });
          return;
        }

        res.json({
          reservation: {
            id: check.reservation.id,
            tableName: check.reservation.tableName,
            reservedAt: check.reservation.reservedAt.toISOString(),
            partySize: check.reservation.partySize,
            status: check.reservation.status,
            hasPreorder: check.reservation.hasPreorder,
            preorderStatus: check.reservation.preorderGuestStatus,
            preorderLabel: check.reservation.preorderLabel,
          },
        });
      } catch (e) {
        console.error("GET table-reservations/preorder-context:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/table-reservations/:id/deposit/pay",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        const reservationId = parseReservationId(req.params.id);
        if (businessId == null || reservationId == null) {
          res.status(400).json({ error: "Некорректные параметры" });
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

        const result = await startReservationDepositPayment({
          businessId,
          reservationId,
          guestTelegramId: telegramId,
        });
        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        res.json({
          paymentUrl: result.paymentUrl,
          paymentId: result.paymentId,
          amountSom: result.amountSom,
        });
      } catch (e) {
        console.error("POST table-reservations/deposit/pay:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/table-reservations/:id/deposit/sync",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        const reservationId = parseReservationId(req.params.id);
        if (businessId == null || reservationId == null) {
          res.status(400).json({ error: "Некорректные параметры" });
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

        const result = await syncGuestReservationDepositPayment({
          businessId,
          reservationId,
          guestTelegramId: telegramId,
        });
        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        const row = await prisma.tableReservation.findUnique({
          where: { id: reservationId },
          include: { table: { select: { name: true, seats: true } } },
        });
        const summaries = await loadReservationPreorderSummaries([reservationId]);

        res.json({
          paymentState: result.paymentState,
          duplicate: "duplicate" in result ? result.duplicate : undefined,
          reservation: row
            ? reservationDto(row, (() => {
                const summary = summaries.get(reservationId);
                return summary ? { preorderSummary: summary } : undefined;
              })())
            : null,
        });
      } catch (e) {
        console.error("POST table-reservations/deposit/sync:", e);
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

      const summaries = await loadReservationPreorderSummaries(rows.map((r) => r.id));

      res.json({
        supported: true,
        reservations: rows.map((r) => {
          const summary = summaries.get(r.id);
          return reservationDto(r, summary ? { preorderSummary: summary } : undefined);
        }),
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

        if (nextStatus === "CONFIRMED" && existing.status === "PENDING") {
          const result = await confirmTableReservationById(id);
          if (!result.ok) {
            const code =
              result.error === "NOT_FOUND"
                ? 404
                : result.error === "WRONG_STATUS"
                  ? 409
                  : 500;
            res.status(code).json({
              error:
                result.error === "WRONG_STATUS"
                  ? "Бронь уже обработана"
                  : result.error === "NOT_FOUND"
                    ? "Бронь не найдена"
                    : "Ошибка сервера",
            });
            return;
          }
          const updated = await prisma.tableReservation.findUnique({
            where: { id },
            include: { table: { select: { name: true, seats: true } } },
          });
          const summaries = await loadReservationPreorderSummaries([id]);
          res.json({
            reservation: reservationDto(updated!, (() => {
              const summary = summaries.get(id);
              return summary ? { preorderSummary: summary } : undefined;
            })()),
          });
          return;
        }

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

        if (nextStatus === "CANCELLED" || nextStatus === "NO_SHOW") {
          await cancelUnpaidPreordersForReservation(id, merchant.businessId);
        }

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

        if (
          nextStatus === "CONFIRMED" &&
          existing.status !== "PENDING" &&
          existing.guestTelegramId
        ) {
          // Re-confirm path: handled by confirmTableReservationById on PENDING only.
        }

        const summaries = await loadReservationPreorderSummaries([id]);
        res.json({
          reservation: reservationDto(updated, (() => {
            const summary = summaries.get(id);
            return summary ? { preorderSummary: summary } : undefined;
          })()),
        });
      } catch (e) {
        console.error("PATCH table-reservations:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );
}
