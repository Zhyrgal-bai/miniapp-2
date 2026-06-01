import type { Express, Request, Response } from "express";
import { prisma } from "./db.js";
import {
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import { businessTypeSupportsTableReservations } from "../shared/tableReservation.js";
import { CreateWaitlistEntrySchema } from "../shared/waitlistSchema.js";
import { parseReservedAtIso, isTableBookableLive } from "./tableReservationService.js";
import {
  acceptWaitlistInvite,
  buildWaitlistBoard,
  declineWaitlistInvite,
  guestHasActiveWaitlistEntry,
  waitlistEntryDto,
} from "./tableReservationWaitlistService.js";
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

const VENUE_DENIED = "Очередь недоступна для этого типа магазина.";

function parseBusinessId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function parseEntryId(raw: string | string[] | undefined): number | null {
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

export async function computeHasBookableTables(businessId: number): Promise<boolean> {
  const tables = await prisma.diningTable.findMany({
    where: { businessId, isActive: true },
    select: { liveStatus: true },
  });
  return tables.some((t) => isTableBookableLive(t.liveStatus));
}

export function attachWaitlistRoutes(app: Express, deps: Deps): void {
  const { requireMerchantStaff, telegramIdFromRequest } = deps;

  app.get(
    "/api/storefront/:businessId/waitlist/context",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        if (businessId == null) {
          res.status(400).json({ error: "Некорректный магазин" });
          return;
        }
        if (!(await assertVenueBusiness(businessId))) {
          res.json({ supported: false, hasBookableTables: false });
          return;
        }
        const hasBookableTables = await computeHasBookableTables(businessId);
        res.json({ supported: true, hasBookableTables });
      } catch (e) {
        console.error("GET waitlist/context:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/waitlist",
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

        const parsed = CreateWaitlistEntrySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.flatten().formErrors.join("; ") || "Некорректные данные",
          });
          return;
        }

        const hasBookable = await computeHasBookableTables(businessId);
        if (hasBookable) {
          res.status(409).json({
            error: "Есть свободные столики — забронируйте стол на карте",
          });
          return;
        }

        if (await guestHasActiveWaitlistEntry(businessId, telegramId)) {
          res.status(409).json({ error: "Вы уже в очереди" });
          return;
        }

        let preferredAt: Date | null = null;
        if (parsed.data.preferredAt) {
          preferredAt = parseReservedAtIso(parsed.data.preferredAt);
        }

        const created = await prisma.waitlistEntry.create({
          data: {
            businessId,
            partySize: parsed.data.partySize,
            guestName: parsed.data.guestName,
            guestPhone: parsed.data.guestPhone,
            guestNote: parsed.data.guestNote ?? null,
            preferredAt,
            guestTelegramId: telegramId,
            status: "WAITING",
          },
        });

        res.status(201).json({ entry: waitlistEntryDto(created) });
      } catch (e) {
        console.error("POST waitlist:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.get(
    "/api/storefront/:businessId/waitlist/mine",
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
          res.json({ supported: false, entries: [] });
          return;
        }

        const rows = await prisma.waitlistEntry.findMany({
          where: {
            businessId,
            guestTelegramId: telegramId,
            status: { in: ["WAITING", "INVITED", "ACCEPTED"] },
          },
          include: { assignedTable: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        const waitingAhead =
          rows[0]?.status === "WAITING"
            ? await prisma.waitlistEntry.count({
                where: {
                  businessId,
                  status: "WAITING",
                  createdAt: { lt: rows[0]!.createdAt },
                },
              })
            : 0;

        res.json({
          supported: true,
          entries: rows.map((r) => waitlistEntryDto(r)),
          queuePosition: waitingAhead + 1,
        });
      } catch (e) {
        console.error("GET waitlist/mine:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/waitlist/:id/accept",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        const entryId = parseEntryId(req.params.id);
        if (businessId == null || entryId == null) {
          res.status(400).json({ error: "Некорректные параметры" });
          return;
        }
        const telegramId = telegramIdFromRequest(req);
        if (!telegramId) {
          res.status(401).json({ error: "Откройте Mini App через Telegram" });
          return;
        }

        const result = await acceptWaitlistInvite(entryId, telegramId);
        if (!result.ok) {
          res.status(result.statusCode).json({ error: result.error });
          return;
        }

        const entry = await prisma.waitlistEntry.findUnique({
          where: { id: entryId },
          include: { assignedTable: { select: { name: true } } },
        });

        res.json({
          reservationId: result.reservationId,
          entry: entry ? waitlistEntryDto(entry) : null,
        });
      } catch (e) {
        console.error("POST waitlist/accept:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post(
    "/api/storefront/:businessId/waitlist/:id/decline",
    async (req: Request, res: Response) => {
      try {
        const businessId = parseBusinessId(req.params.businessId);
        const entryId = parseEntryId(req.params.id);
        if (businessId == null || entryId == null) {
          res.status(400).json({ error: "Некорректные параметры" });
          return;
        }
        const telegramId = telegramIdFromRequest(req);
        if (!telegramId) {
          res.status(401).json({ error: "Откройте Mini App через Telegram" });
          return;
        }

        const result = await declineWaitlistInvite(entryId, telegramId);
        if (!result.ok) {
          res.status(result.statusCode).json({ error: result.error });
          return;
        }

        res.json({ ok: true });
      } catch (e) {
        console.error("POST waitlist/decline:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.get("/api/merchant/waitlist", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED, supported: false });
        return;
      }

      const board = await buildWaitlistBoard(merchant.businessId);
      res.json({ supported: true, ...board });
    } catch (e) {
      console.error("GET merchant/waitlist:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.patch(
    "/api/merchant/waitlist/:id",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
        if (!merchant) return;
        if (!(await assertVenueBusiness(merchant.businessId))) {
          res.status(403).json({ error: VENUE_DENIED });
          return;
        }

        const id = parseEntryId(req.params.id);
        if (id == null) {
          res.status(400).json({ error: "Некорректный id" });
          return;
        }

        const status = String((req.body as { status?: string }).status ?? "").toUpperCase();
        if (status !== "CANCELLED") {
          res.status(400).json({ error: "Поддерживается только отмена" });
          return;
        }

        const existing = await prisma.waitlistEntry.findFirst({
          where: { id, businessId: merchant.businessId },
        });
        if (!existing) {
          res.status(404).json({ error: "Запись не найдена" });
          return;
        }

        const tableId = existing.assignedTableId;
        await prisma.waitlistEntry.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            assignedTableId: null,
            invitedAt: null,
            inviteExpiresAt: null,
          },
        });

        if (tableId != null && existing.status === "INVITED") {
          const { tryInviteWaitlistForTable } = await import(
            "./tableReservationWaitlistService.js"
          );
          await tryInviteWaitlistForTable(merchant.businessId, tableId);
        }

        res.json({ ok: true });
      } catch (e) {
        console.error("PATCH merchant/waitlist:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );
}
