import type { Express, Request, Response } from "express";
import type { BusinessType, Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import {
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import { businessTypeSupportsTableReservations } from "../shared/tableReservation.js";
import {
  DiningTableInputSchema,
  DiningTableLayoutPatchSchema,
  DiningTablePatchSchema,
} from "../shared/diningTableSchema.js";

type Deps = {
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<{ businessId: number } | null>;
};

const VENUE_DENIED = "Раздел столиков доступен только для кафе и фастфуда.";

function parseTableId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function assertVenueBusiness(businessId: number): Promise<BusinessType | null> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true },
  });
  if (!b) return null;
  if (!businessTypeSupportsTableReservations(b.businessType)) return null;
  return b.businessType;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tableToDto(
  row: {
    id: number;
    name: string;
    seats: number;
    shape: string;
    description: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    status: string;
    sortOrder: number;
    isActive: boolean;
  },
  nextReservation: { reservedAt: Date; guestName: string | null } | null,
) {
  return {
    id: row.id,
    name: row.name,
    seats: row.seats,
    shape: row.shape,
    description: row.description,
    posX: row.posX,
    posY: row.posY,
    width: row.width,
    height: row.height,
    status: row.status,
    liveStatus: (row as { liveStatus?: string }).liveStatus ?? row.status,
    qrToken: (row as { qrToken?: string }).qrToken ?? null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    nextReservation: nextReservation
      ? {
          reservedAt: nextReservation.reservedAt.toISOString(),
          guestName: nextReservation.guestName,
        }
      : null,
  };
}

export function attachDiningTableRoutes(app: Express, deps: Deps): void {
  const { requireMerchantStaff } = deps;

  app.get("/api/merchant/dining-tables", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;

      const bt = await assertVenueBusiness(merchant.businessId);
      if (!bt) {
        res.status(403).json({ error: VENUE_DENIED, supported: false });
        return;
      }

      const tables = await prisma.diningTable.findMany({
        where: { businessId: merchant.businessId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      const now = new Date();
      const reservations = await prisma.tableReservation.findMany({
        where: {
          businessId: merchant.businessId,
          status: { in: ["PENDING", "CONFIRMED"] },
          reservedAt: { gte: now },
        },
        orderBy: { reservedAt: "asc" },
        select: {
          tableId: true,
          reservedAt: true,
          guestName: true,
        },
      });

      const nextByTable = new Map<number, { reservedAt: Date; guestName: string | null }>();
      for (const r of reservations) {
        if (!nextByTable.has(r.tableId)) {
          nextByTable.set(r.tableId, {
            reservedAt: r.reservedAt,
            guestName: r.guestName,
          });
        }
      }

      res.json({
        supported: true,
        businessType: bt,
        tables: tables.map((t) => tableToDto(t, nextByTable.get(t.id) ?? null)),
      });
    } catch (e) {
      console.error("GET /api/merchant/dining-tables:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post("/api/merchant/dining-tables", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;

      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }

      const parsed = DiningTableInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().formErrors.join("; ") });
        return;
      }

      const count = await prisma.diningTable.count({
        where: { businessId: merchant.businessId, isActive: true },
      });
      if (count >= 80) {
        res.status(400).json({ error: "Максимум 80 столиков на зал." });
        return;
      }

      const d = parsed.data;
      const created = await prisma.diningTable.create({
        data: {
          businessId: merchant.businessId,
          name: d.name,
          seats: d.seats,
          shape: d.shape,
          description: d.description ?? "",
          posX: clamp01(d.posX ?? 0.08 + (count % 5) * 0.14),
          posY: clamp01(d.posY ?? 0.12 + Math.floor(count / 5) * 0.16),
          width: d.width ?? 0.14,
          height: d.height ?? 0.12,
          status: d.status ?? "AVAILABLE",
          sortOrder: d.sortOrder ?? count,
        },
      });

      res.status(201).json({ table: tableToDto(created, null) });
    } catch (e) {
      console.error("POST /api/merchant/dining-tables:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.put("/api/merchant/dining-tables/layout", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;

      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }

      const parsed = DiningTableLayoutPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().formErrors.join("; ") });
        return;
      }

      const ids = parsed.data.tables.map((t) => t.id);
      const owned = await prisma.diningTable.findMany({
        where: { businessId: merchant.businessId, id: { in: ids }, isActive: true },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((o) => o.id));
      if (ownedSet.size !== ids.length) {
        res.status(400).json({ error: "Некорректный список столиков." });
        return;
      }

      await prisma.$transaction(
        parsed.data.tables.map((t) =>
          prisma.diningTable.update({
            where: { id: t.id },
            data: {
              posX: clamp01(t.posX),
              posY: clamp01(t.posY),
              width: t.width,
              height: t.height,
            },
          }),
        ),
      );

      res.json({ ok: true });
    } catch (e) {
      console.error("PUT /api/merchant/dining-tables/layout:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.put("/api/merchant/dining-tables/:id", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;

      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }

      const tableId = parseTableId(req.params.id);
      if (tableId == null) {
        res.status(400).json({ error: "Некорректный id" });
        return;
      }

      const parsed = DiningTablePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().formErrors.join("; ") });
        return;
      }

      const existing = await prisma.diningTable.findFirst({
        where: { id: tableId, businessId: merchant.businessId },
      });
      if (!existing) {
        res.status(404).json({ error: "Столик не найден" });
        return;
      }

      const d = parsed.data;
      const data: Prisma.DiningTableUpdateInput = {};
      if (d.name !== undefined) data.name = d.name;
      if (d.seats !== undefined) data.seats = d.seats;
      if (d.shape !== undefined) data.shape = d.shape;
      if (d.description !== undefined) data.description = d.description;
      if (d.posX !== undefined) data.posX = clamp01(d.posX);
      if (d.posY !== undefined) data.posY = clamp01(d.posY);
      if (d.width !== undefined) data.width = d.width;
      if (d.height !== undefined) data.height = d.height;
      if (d.status !== undefined) data.status = d.status;
      if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;
      if (d.isActive !== undefined) data.isActive = d.isActive;

      const updated = await prisma.diningTable.update({
        where: { id: tableId },
        data,
      });

      res.json({ table: tableToDto(updated, null) });
    } catch (e) {
      console.error("PUT /api/merchant/dining-tables/:id:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.delete("/api/merchant/dining-tables/:id", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;

      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }

      const tableId = parseTableId(req.params.id);
      if (tableId == null) {
        res.status(400).json({ error: "Некорректный id" });
        return;
      }

      const existing = await prisma.diningTable.findFirst({
        where: { id: tableId, businessId: merchant.businessId },
      });
      if (!existing) {
        res.status(404).json({ error: "Столик не найден" });
        return;
      }

      await prisma.diningTable.update({
        where: { id: tableId },
        data: { isActive: false },
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/merchant/dining-tables/:id:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });
}
