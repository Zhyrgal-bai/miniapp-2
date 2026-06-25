import type { Express, Request, Response } from "express";
import type { MerchantStaffContext } from "./deliveryRouteAuth.js";
import type { MerchantPermissionId } from "../merchantPermissions.js";
import { getMerchantDeliveryDashboard } from "./services/deliveryMerchantDashboardService.js";

export type DeliveryMerchantDashboardRouteDeps = {
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<MerchantStaffContext | null>;
  ordersManagePermission: MerchantPermissionId;
};

export function attachDeliveryMerchantDashboardRoutes(
  app: Express,
  deps: DeliveryMerchantDashboardRouteDeps,
): void {
  app.get("/api/merchant/delivery/dashboard", async (req, res) => {
    try {
      const merchant = await deps.requireMerchantStaff(
        req,
        res,
        deps.ordersManagePermission,
      );
      if (!merchant) return;

      const dashboard = await getMerchantDeliveryDashboard(merchant.businessId);
      res.json(dashboard);
    } catch {
      res.status(500).json({ ok: false, message: "Не удалось загрузить дашборд доставки." });
    }
  });
}
