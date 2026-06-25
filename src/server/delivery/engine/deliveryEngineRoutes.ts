import type { Express, Request, Response } from "express";
import type { MerchantStaffContext } from "../deliveryRouteAuth.js";
import type { MerchantPermissionId } from "../../merchantPermissions.js";
import { listDeliveryProvidersPublic } from "./DeliveryEngine.js";
import "./deliveryEngineBootstrap.js";
import {
  createOperatorProviderDashboardService,
  createDeliveryProviderAnalyticsService,
} from "./services/deliveryProviderAnalyticsService.js";
import { prisma } from "../../db.js";
import {
  defaultMerchantDeliveryProviderPolicy,
  extractProviderPolicyFromDeliverySettings,
  parseMerchantDeliveryProviderPolicy,
  type MerchantDeliveryProviderPolicy,
} from "../../../shared/merchantDeliveryProviderPolicy.js";

export type DeliveryEngineRouteDeps = {
  operatorAuth: {
    requireOperatorUnlock: (
      req: Request,
      res: Response,
    ) => Promise<{ telegramId: string; token: string } | null>;
  };
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<MerchantStaffContext | null>;
  settingsManagePermission: MerchantPermissionId;
};

const operatorDashboard = createOperatorProviderDashboardService();
const providerAnalytics = createDeliveryProviderAnalyticsService();

function parsePeriod(raw: unknown): "daily" | "weekly" | "monthly" {
  if (raw === "weekly" || raw === "monthly" || raw === "daily") return raw;
  return "daily";
}

/** Phase 7 — multi-provider delivery engine APIs. */
export function attachDeliveryEngineRoutes(app: Express, deps: DeliveryEngineRouteDeps): void {
  app.get("/api/delivery/providers", async (_req, res) => {
    try {
      const providers = await listDeliveryProvidersPublic();
      res.json({ providers });
    } catch {
      res.status(500).json({ ok: false, message: "Не удалось загрузить провайдеров." });
    }
  });

  app.get("/api/operator/delivery/providers/dashboard", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const period = parsePeriod(req.query.period);
      const dashboard = await operatorDashboard.getDashboard(period);
      res.json(dashboard);
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/operator/delivery/providers/analytics", async (req, res) => {
    const op = await deps.operatorAuth.requireOperatorUnlock(req, res);
    if (!op) return;
    try {
      const period = parsePeriod(req.query.period);
      const report = await providerAnalytics.getAnalytics(period);
      res.json(report);
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/merchant/delivery/providers", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.settingsManagePermission,
    );
    if (!merchant) return;
    try {
      const business = await prisma.business.findUnique({
        where: { id: merchant.businessId },
        select: { deliverySettings: true },
      });
      const policy = extractProviderPolicyFromDeliverySettings(business?.deliverySettings);
      const providers = await listDeliveryProvidersPublic();
      res.json({ policy, providers });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.patch("/api/merchant/delivery/providers", async (req, res) => {
    const merchant = await deps.requireMerchantStaff(
      req,
      res,
      deps.settingsManagePermission,
    );
    if (!merchant) return;
    try {
      const parsed = parseMerchantDeliveryProviderPolicy(req.body);

      const business = await prisma.business.findUnique({
        where: { id: merchant.businessId },
        select: { deliverySettings: true },
      });

      const existing =
        business?.deliverySettings != null && typeof business.deliverySettings === "object"
          ? (business.deliverySettings as Record<string, unknown>)
          : {};

      const nextSettings = {
        ...existing,
        providerPolicy: parsed.ok ? parsed.value : defaultMerchantDeliveryProviderPolicy(),
      };

      await prisma.business.update({
        where: { id: merchant.businessId },
        data: { deliverySettings: nextSettings },
      });

      res.json({
        ok: true,
        policy: parsed.ok ? parsed.value : defaultMerchantDeliveryProviderPolicy(),
      });
    } catch {
      res.status(500).json({ ok: false, message: "Не удалось сохранить настройки." });
    }
  });
}

export type { MerchantDeliveryProviderPolicy };
