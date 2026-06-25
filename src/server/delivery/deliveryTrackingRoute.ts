import type { Express, Request, Response } from "express";
import type { MerchantStaffContext } from "./deliveryRouteAuth.js";
import { logAuthReject } from "../structuredLog.js";
import { prisma } from "../db.js";
import type { MerchantPermissionId } from "../merchantPermissions.js";
import {
  createDeliveryTrackingService,
} from "./services/deliveryTrackingService.js";

export type DeliveryTrackingRouteDeps = {
  telegramIdFromRequest: (req: Request) => string | null;
  resolveCatalogBusinessId: (req: Request, res: Response) => Promise<number | null>;
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<MerchantStaffContext | null>;
  ordersManagePermission: MerchantPermissionId;
  trackingService?: ReturnType<typeof createDeliveryTrackingService>;
};

function parseOrderId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function orderIdFromParams(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;
  return parseOrderId(value);
}

export function attachDeliveryTrackingRoutes(
  app: Express,
  deps: DeliveryTrackingRouteDeps,
): void {
  const trackingService = deps.trackingService ?? createDeliveryTrackingService();

  app.get("/api/delivery/:orderId/tracking", async (req: Request, res: Response) => {
    try {
      const telegramId = deps.telegramIdFromRequest(req);
      if (!telegramId) {
        logAuthReject({
          path: req.path ?? req.url,
          reason: "delivery_tracking_missing_telegram_id",
        });
        res.status(401).json({ error: "Требуется авторизация Telegram Mini App" });
        return;
      }

      const businessId = await deps.resolveCatalogBusinessId(req, res);
      if (!businessId) return;

      const orderId = orderIdFromParams(req.params.orderId);
      if (orderId == null) {
        res.status(400).json({ ok: false, code: "invalid_order_id" });
        return;
      }

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          businessId,
          buyerUser: { telegramId },
        },
        select: { id: true },
      });

      if (!order) {
        res.status(404).json({ ok: false, code: "not_found", message: "Заказ не найден." });
        return;
      }

      const result = await trackingService.getTrackingForOrder(orderId, "customer");
      if (!result.ok) {
        res.status(404).json(result);
        return;
      }

      res.json(result.tracking);
    } catch {
      res.status(500).json({ ok: false, message: "Не удалось загрузить статус доставки." });
    }
  });

  app.get(
    "/api/delivery/:orderId/tracking/merchant",
    async (req: Request, res: Response) => {
      try {
        const merchant = await deps.requireMerchantStaff(
          req,
          res,
          deps.ordersManagePermission,
        );
        if (!merchant) return;

        const orderId = orderIdFromParams(req.params.orderId);
        if (orderId == null) {
          res.status(400).json({ ok: false, code: "invalid_order_id" });
          return;
        }

        const order = await prisma.order.findFirst({
          where: { id: orderId, businessId: merchant.businessId },
          select: { id: true },
        });

        if (!order) {
          res.status(404).json({ ok: false, code: "not_found", message: "Заказ не найден." });
          return;
        }

        const result = await trackingService.getTrackingForOrder(orderId, "merchant");
        if (!result.ok) {
          res.status(404).json(result);
          return;
        }

        res.json(result.tracking);
      } catch {
        res.status(500).json({ ok: false, message: "Не удалось загрузить статус доставки." });
      }
    },
  );
}
