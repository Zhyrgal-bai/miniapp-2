import type { Express, Request, Response } from "express";
import type { OrderPrepStatus, TableLiveStatus } from "@prisma/client";
import {
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import { subscribeVenueUpdates } from "./venueRealtime.js";
import {
  assertVenueBusiness,
  attachOrderToSession,
  buildFloorSnapshot,
  buildKitchenBoard,
  buildVenueMetrics,
  closeTableSession,
  joinTableViaQr,
  openTableSession,
  requestSessionPayment,
  resolveTableQrToken,
  setOrderPrepStatus,
  setTableLiveStatus,
} from "./venueOperationsService.js";
import { notifyTablePaymentRequested } from "./venueOperationsNotify.js";

type Deps = {
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<{ businessId: number; staffId?: number } | null>;
  telegramIdFromRequest: (req: Request) => string | null;
};

const VENUE_DENIED = "Операции зала доступны только для кафе и фастфуда.";

function parseId(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function attachVenueOperationsRoutes(app: Express, deps: Deps): void {
  const { requireMerchantStaff, telegramIdFromRequest } = deps;

  app.get("/api/merchant/venue/live-stream", async (req: Request, res: Response) => {
    const merchant = await requireMerchantStaff(req, res, [
      MERCHANT_PERM.floorManage,
      MERCHANT_PERM.kitchenView,
    ]);
    if (!merchant) return;
    if (!(await assertVenueBusiness(merchant.businessId))) {
      res.status(403).end();
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendTick = () => {
      res.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    };

    sendTick();
    const heartbeat = setInterval(sendTick, 25_000);

    const unsub = subscribeVenueUpdates(merchant.businessId, (payload) => {
      res.write(`event: venue\ndata: ${JSON.stringify(payload)}\n\n`);
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      unsub();
    });
  });

  app.get("/api/merchant/venue/floor", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }
      res.json(await buildFloorSnapshot(merchant.businessId));
    } catch (e) {
      console.error("GET venue/floor:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.get("/api/merchant/venue/kitchen", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.kitchenView);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }
      res.json(await buildKitchenBoard(merchant.businessId));
    } catch (e) {
      console.error("GET venue/kitchen:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.get("/api/merchant/venue/metrics", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }
      res.json(await buildVenueMetrics(merchant.businessId));
    } catch (e) {
      console.error("GET venue/metrics:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post("/api/merchant/venue/sessions/open", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
      if (!merchant) return;
      if (!(await assertVenueBusiness(merchant.businessId))) {
        res.status(403).json({ error: VENUE_DENIED });
        return;
      }
      const tableId = parseId((req.body as { tableId?: unknown }).tableId as string);
      const reservationId = parseId((req.body as { reservationId?: unknown }).reservationId as string);
      const partySize = Number((req.body as { partySize?: unknown }).partySize);
      if (tableId == null) {
        res.status(400).json({ error: "Укажите tableId" });
        return;
      }
      const result = await openTableSession({
        businessId: merchant.businessId,
        tableId,
        ...(reservationId != null ? { reservationId } : {}),
        waiterStaffId: merchant.staffId ?? null,
        partySize: Number.isFinite(partySize) ? partySize : null,
      });
      res.status(201).json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "TABLE_BUSY") {
        res.status(409).json({ error: "Стол уже занят" });
        return;
      }
      console.error("POST venue/sessions/open:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post(
    "/api/merchant/venue/sessions/:id/request-payment",
    async (req: Request, res: Response) => {
      try {
        const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
        if (!merchant) return;
        const sessionId = parseId(req.params.id);
        if (sessionId == null) {
          res.status(400).json({ error: "Некорректный id" });
          return;
        }
        await requestSessionPayment(merchant.businessId, sessionId);
        void notifyTablePaymentRequested(sessionId);
        res.json({ ok: true });
      } catch (e) {
        console.error("POST request-payment:", e);
        res.status(500).json({ error: "Ошибка сервера" });
      }
    },
  );

  app.post("/api/merchant/venue/sessions/:id/close", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
      if (!merchant) return;
      const sessionId = parseId(req.params.id);
      if (sessionId == null) {
        res.status(400).json({ error: "Некорректный id" });
        return;
      }
      await closeTableSession(merchant.businessId, sessionId);
      res.json({ ok: true });
    } catch (e) {
      console.error("POST session close:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.patch("/api/merchant/venue/tables/:id/live-status", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.floorManage);
      if (!merchant) return;
      const tableId = parseId(req.params.id);
      const liveStatus = String((req.body as { liveStatus?: string }).liveStatus ?? "").toUpperCase();
      const allowed: TableLiveStatus[] = [
        "FREE",
        "RESERVED",
        "ARRIVED",
        "ORDERING",
        "EATING",
        "PAYMENT",
        "CLEANING",
      ];
      if (tableId == null || !allowed.includes(liveStatus as TableLiveStatus)) {
        res.status(400).json({ error: "Некорректные данные" });
        return;
      }
      await setTableLiveStatus(merchant.businessId, tableId, liveStatus as TableLiveStatus);
      res.json({ ok: true });
    } catch (e) {
      console.error("PATCH live-status:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.patch("/api/merchant/venue/orders/:id/prep", async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.kitchenView);
      if (!merchant) return;
      const orderId = parseId(req.params.id);
      const prepStatus = String((req.body as { prepStatus?: string }).prepStatus ?? "").toUpperCase();
      const allowed: OrderPrepStatus[] = ["PREPARING", "READY", "SERVED", "NONE"];
      if (orderId == null || !allowed.includes(prepStatus as OrderPrepStatus)) {
        res.status(400).json({ error: "Некорректные данные" });
        return;
      }
      await setOrderPrepStatus(merchant.businessId, orderId, prepStatus as OrderPrepStatus);
      res.json({ ok: true });
    } catch (e) {
      console.error("PATCH order prep:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.get("/api/storefront/table-qr/:token", async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token ?? "").trim();
      const table = await resolveTableQrToken(token);
      if (!table) {
        res.status(404).json({ error: "Стол не найден" });
        return;
      }
      res.json({
        businessId: table.businessId,
        tableId: table.id,
        tableName: table.name,
        seats: table.seats,
        sessionId: table.activeSessionId,
        storeName: table.business.name,
      });
    } catch (e) {
      console.error("GET table-qr:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post("/api/storefront/table-qr/:token/join", async (req: Request, res: Response) => {
    try {
      const telegramId = telegramIdFromRequest(req);
      if (!telegramId) {
        res.status(401).json({ error: "Откройте через Telegram" });
        return;
      }
      const token = String(req.params.token ?? "").trim();
      const partySize = Number((req.body as { partySize?: unknown }).partySize);
      const joined = await joinTableViaQr({
        qrToken: token,
        telegramId,
        ...(Number.isFinite(partySize) ? { partySize } : {}),
      });
      if (!joined) {
        res.status(404).json({ error: "Стол недоступен" });
        return;
      }
      res.json(joined);
    } catch (e) {
      console.error("POST table-qr join:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });
}
