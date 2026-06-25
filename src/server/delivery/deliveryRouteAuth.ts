import type { Request, Response } from "express";
import { MERCHANT_PERM, type MerchantPermissionId } from "../merchantPermissions.js";
import { logAuthReject } from "../structuredLog.js";

export type MerchantStaffContext = {
  businessId: number;
  staffId: number;
  role: string;
  effectivePermissions: MerchantPermissionId[];
};

export type DeliveryOffersAuthContext =
  | { kind: "operator"; telegramId: string }
  | ({ kind: "merchant" } & MerchantStaffContext);

export type DeliveryOffersRouteDeps = {
  tryOperatorUnlock: (req: Request) => Promise<{ telegramId: string } | null>;
  requireMerchantStaff: (
    req: Request,
    res: Response,
    requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
  ) => Promise<MerchantStaffContext | null>;
  telegramIdFromRequest: (req: Request) => string | null;
};

/**
 * Merchant staff (settings.manage) or unlocked platform operator.
 * OAuth token never leaves the server; this gate protects the debug offers proxy.
 */
export async function requireDeliveryOffersAccess(
  req: Request,
  res: Response,
  deps: DeliveryOffersRouteDeps,
): Promise<DeliveryOffersAuthContext | null> {
  const operator = await deps.tryOperatorUnlock(req);
  if (operator) {
    return { kind: "operator", telegramId: operator.telegramId };
  }

  const telegramId = deps.telegramIdFromRequest(req);
  if (!telegramId) {
    logAuthReject({
      path: req.path ?? req.url,
      reason: "delivery_offers_missing_telegram_id",
      ...(req.ip ? { ip: req.ip } : {}),
    });
    res.status(401).json({
      error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
    });
    return null;
  }

  const merchant = await deps.requireMerchantStaff(
    req,
    res,
    MERCHANT_PERM.settingsManage,
  );
  if (merchant) {
    return { kind: "merchant", ...merchant };
  }

  if (!res.headersSent) {
    res.status(403).json({ error: "Недостаточно прав" });
  }
  return null;
}
