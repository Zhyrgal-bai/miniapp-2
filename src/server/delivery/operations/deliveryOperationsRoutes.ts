import type { Express, Request, Response } from "express";
import type { MerchantStaffContext } from "../deliveryRouteAuth.js";
import type { MerchantPermissionId } from "../../merchantPermissions.js";
import { createDeliveryOperationsDetailService } from "./services/deliveryOperationsDetailService.js";
import { createDeliveryOperatorDashboardService } from "./services/deliveryOperatorDashboardService.js";
import {
  createDeliverySearchService,
  parseDeliverySearchQuery,
} from "./services/deliverySearchService.js";
import { createDeliveryAnalyticsService } from "./services/deliveryAnalyticsService.js";
import {
  createDeliveryExportService,
  parseExportFormat,
} from "./services/deliveryExportService.js";
import { createDeliveryManualOperationsService } from "./services/deliveryManualOperationsService.js";
import { createDeliveryEventsUiService } from "./services/deliveryEventsUiService.js";
import {
  createDeliveryTimelineRepository,
} from "./repositories/deliveryTimelineRepository.js";
import {
  createDeliveryAuditRepository,
} from "./repositories/deliveryAuditRepository.js";
import type { AnalyticsPeriod } from "./types/deliveryOperationsTypes.js";

export type OperatorAuth = {
  requireOperatorUnlock: (
    req: Request,
    res: Response,
  ) => Promise<{ telegramId: string; token: string } | null>;
  requireOperatorRecentReauth: (
    req: Request,
    res: Response,
  ) => Promise<{ telegramId: string; token: string } | null>;
};

export type DeliveryOperationsRouteDeps = {
  operatorAuth: OperatorAuth;
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<MerchantStaffContext | null>;
  ordersManagePermission: MerchantPermissionId;
  telegramIdFromRequest: (req: Request) => string | null;
  orderOwnedByTelegramUser: (
    orderId: number,
    telegramId: string,
  ) => Promise<boolean>;
};

const detailService = createDeliveryOperationsDetailService();
const operatorDashboard = createDeliveryOperatorDashboardService();
const searchService = createDeliverySearchService();
const analyticsService = createDeliveryAnalyticsService();
const exportService = createDeliveryExportService();
const manualOps = createDeliveryManualOperationsService();
const eventsUi = createDeliveryEventsUiService();
const timelineRepo = createDeliveryTimelineRepository();
const auditRepo = createDeliveryAuditRepository();

function parsePeriod(raw: unknown): AnalyticsPeriod {
  if (raw === "weekly" || raw === "monthly" || raw === "daily") return raw;
  return "daily";
}

/** Phase 6 — Delivery Operations Platform routes (provider-agnostic). */
export function attachDeliveryOperationsRoutes(
  app: Express,
  deps: DeliveryOperationsRouteDeps,
): void {
  // ── Platform operator ──────────────────────────────────────────────

  app.get("/api/operator/delivery/dashboard", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const period = parsePeriod(req.query.period);
      const dashboard = await operatorDashboard.getDashboard(period);
      res.json(dashboard);
    } catch {
      res.status(500).json({ ok: false, message: "Не удалось загрузить дашборд." });
    }
  });

  app.get("/api/operator/delivery/search", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const { filters, page, pageSize } = parseDeliverySearchQuery(
        req.query as Record<string, unknown>,
      );
      const result = await searchService.search(filters, page, pageSize, "PLATFORM_OPERATOR");
      res.json(result);
    } catch {
      res.status(500).json({ ok: false, message: "Ошибка поиска доставок." });
    }
  });

  app.get("/api/operator/delivery/analytics", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const period = parsePeriod(req.query.period);
      const report = await analyticsService.getAnalytics(period);
      res.json(report);
    } catch {
      res.status(500).json({ ok: false, message: "Ошибка аналитики." });
    }
  });

  app.get("/api/operator/delivery/export", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const exportType = String(req.query.type ?? "dashboard");
      const format = parseExportFormat(req.query.format);
      const period = parsePeriod(req.query.period);

      let rows: Record<string, unknown>[] = [];
      if (exportType === "dashboard") {
        const d = await operatorDashboard.getDashboard(period);
        rows = [d as unknown as Record<string, unknown>];
      } else if (exportType === "analytics") {
        const a = await analyticsService.getAnalytics(period);
        rows = [a as unknown as Record<string, unknown>];
      } else if (exportType === "timeline") {
        const deliveryId = Number(req.query.deliveryId);
        if (Number.isFinite(deliveryId)) {
          const events = await timelineRepo.listByDeliveryId(deliveryId);
          rows = events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
        }
      } else if (exportType === "audit") {
        const deliveryId = Number(req.query.deliveryId);
        const logs =
          Number.isFinite(deliveryId)
            ? await auditRepo.listByDeliveryId(deliveryId)
            : await auditRepo.listPlatform(500);
        rows = logs.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
      } else if (exportType === "search") {
        const { filters, page, pageSize } = parseDeliverySearchQuery(
          req.query as Record<string, unknown>,
        );
        const result = await searchService.search(filters, page, pageSize, "PLATFORM_OPERATOR");
        rows = result.items as unknown as Record<string, unknown>[];
      }

      const payload = exportService.exportRows(exportType, format, rows, "PLATFORM_OPERATOR");
      res.setHeader("Content-Type", payload.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
      res.send(payload.body);
    } catch {
      res.status(500).json({ ok: false, message: "Ошибка экспорта." });
    }
  });

  app.get("/api/operator/deliveries/:deliveryId", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    if (!Number.isFinite(deliveryId)) {
      res.status(400).json({ ok: false, message: "Некорректный id доставки." });
      return;
    }
    try {
      const result = await detailService.getDetails(deliveryId, { includeAudit: true });
      if (!result.ok) {
        res.status(404).json({ ok: false, message: "Доставка не найдена." });
        return;
      }
      manualOps.logDeliveryOpened(deliveryId, result.details.order.id, {
        actor: "PLATFORM_OPERATOR",
        actorId: op.telegramId,
      });
      res.json({
        ...result.details,
        actions: {
          ...result.details.actions,
          providerPortalUrl: result.details.actions.providerPortalUrl,
        },
      });
    } catch {
      res.status(500).json({ ok: false, message: "Ошибка загрузки доставки." });
    }
  });

  app.get("/api/operator/deliveries/:deliveryId/timeline", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    if (!Number.isFinite(deliveryId)) {
      res.status(400).json({ ok: false });
      return;
    }
    const events = await eventsUi.getEventsForDelivery(deliveryId, "PLATFORM_OPERATOR");
    res.json({ events });
  });

  app.get("/api/operator/deliveries/:deliveryId/audit", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    if (!Number.isFinite(deliveryId)) {
      res.status(400).json({ ok: false });
      return;
    }
    const audit = await auditRepo.listByDeliveryId(deliveryId);
    res.json({ audit });
  });

  app.post("/api/operator/deliveries/:deliveryId/refresh", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorRecentReauth(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    const result = await manualOps.refreshDelivery(deliveryId, {
      actor: "PLATFORM_OPERATOR",
      actorId: op.telegramId,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/operator/deliveries/:deliveryId/force-refresh", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorRecentReauth(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    const result = await manualOps.refreshDelivery(
      deliveryId,
      { actor: "PLATFORM_OPERATOR", actorId: op.telegramId },
      { force: true },
    );
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/operator/deliveries/:deliveryId/retry-recovery", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorRecentReauth(req, res);
    if (!op) return;
    const deliveryId = Number(req.params.deliveryId);
    const result = await manualOps.retryRecovery(deliveryId, {
      actor: "PLATFORM_OPERATOR",
      actorId: op.telegramId,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Merchant (tenant-scoped) ───────────────────────────────────────

  app.get("/api/merchant/delivery/search", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.ordersManagePermission,
    );
    if (!merchant) return;
    try {
      const { filters, page, pageSize } = parseDeliverySearchQuery(
        req.query as Record<string, unknown>,
        merchant.businessId,
      );
      const result = await searchService.search(filters, page, pageSize, "MERCHANT");
      res.json(result);
    } catch {
      res.status(500).json({ ok: false, message: "Ошибка поиска." });
    }
  });

  app.get("/api/merchant/delivery/:deliveryId", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.ordersManagePermission,
    );
    if (!merchant) return;
    const deliveryId = Number(req.params.deliveryId);
    if (!Number.isFinite(deliveryId)) {
      res.status(400).json({ ok: false });
      return;
    }
    const result = await detailService.getDetails(deliveryId, {
      businessId: merchant.businessId,
      includeAudit: false,
    });
    if (!result.ok) {
      res.status(404).json({ ok: false, message: "Доставка не найдена." });
      return;
    }
    manualOps.logDeliveryOpened(deliveryId, result.details.order.id, {
      actor: "MERCHANT",
      actorId: String(merchant.staffId),
    });
    res.json(result.details);
  });

  app.get("/api/merchant/delivery/:deliveryId/timeline", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.ordersManagePermission,
    );
    if (!merchant) return;
    const deliveryId = Number(req.params.deliveryId);
    const row = await detailService.getDetails(deliveryId, {
      businessId: merchant.businessId,
    });
    if (!row.ok) {
      res.status(404).json({ ok: false });
      return;
    }
    const events = await eventsUi.getEventsForDelivery(deliveryId, "MERCHANT");
    res.json({ events });
  });

  app.post("/api/merchant/delivery/:deliveryId/refresh", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.ordersManagePermission,
    );
    if (!merchant) return;
    const deliveryId = Number(req.params.deliveryId);
    const result = await manualOps.refreshDelivery(
      deliveryId,
      { actor: "MERCHANT", actorId: String(merchant.staffId) },
      { businessId: merchant.businessId },
    );
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.get("/api/merchant/delivery/analytics", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.ordersManagePermission,
    );
    if (!merchant) return;
    const period = parsePeriod(req.query.period);
    const report = await analyticsService.getAnalytics(period, merchant.businessId);
    res.json(report);
  });

  // ── Customer events UI ───────────────────────────────────────────────

  app.get("/api/delivery/:orderId/events", async (req, res) => {
    const telegramId = deps.telegramIdFromRequest(req);
    if (!telegramId) {
      res.status(401).json({ ok: false, message: "Требуется авторизация." });
      return;
    }
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
      res.status(400).json({ ok: false });
      return;
    }
    const owned = await deps.orderOwnedByTelegramUser(orderId, telegramId);
    if (!owned) {
      res.status(404).json({ ok: false, message: "Заказ не найден." });
      return;
    }
    const events = await eventsUi.getEventsForOrder(orderId, "CUSTOMER");
    res.json({ events });
  });
}
