import type { NextFunction, Request, Response } from "express";
import type { Business, User } from "@prisma/client";
import type { BusinessStaffRecord } from "../server/businessStaffAccess.js";
import { prisma } from "../server/db.js";
import { resolveBusinessStaffRecord } from "../server/businessStaffBackfill.js";
import {
  type SubscriptionGateFields,
  isSubscriptionActive,
  isStorefrontClosedForCustomers,
} from "../server/subscriptionAccess.js";
import { verifiedTelegramIdFromRequest } from "./verifiedTelegramAuth.js";
import { acceptPendingStaffInvitesForUser } from "../server/businessStaffService.js";
import { parseTelegramWebAppUserFromInitData } from "../server/telegramWebAppInitData.js";
import { syncTelegramUserProfile } from "../server/telegramUserSync.js";
import { API_ERR_STORE_UNAVAILABLE } from "../shared/apiClientMessages.js";
import { isPublicStorefrontBookingPath } from "../shared/storefrontPublicPaths.js";

declare global {
  namespace Express {
    interface Request {
      businessId?: number;
      tenantUser?: User | null;
      tenantBusiness?: Business;
      tenantStaff?: BusinessStaffRecord | null;
    }
  }
}

/** Public `/api/*` endpoints that bypass tenant middleware */
const SKIP_PATH_PREFIXES = ["/health", "/ready"];

function trimmedHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

/** Same digit rules as public catalog endpoints (see `businessIdFromNonApiHint`). */
function parseTenantHintInt(raw: unknown): number | undefined {
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return undefined;
  return n;
}

export function telegramFromRequest(req: Request): string | null {
  return verifiedTelegramIdFromRequest(req);
}

/** `?businessId` → `?shop` → `x-business-id` → JSON `businessId` / `shop`. */
function businessIdHintFromRequest(req: Request): number | undefined {
  const fromBid = parseTenantHintInt(req.query.businessId);
  if (fromBid !== undefined) return fromBid;

  const fromShop = parseTenantHintInt(req.query.shop);
  if (fromShop !== undefined) return fromShop;

  const hRaw = trimmedHeader(req, "x-business-id");
  const fromHeader = hRaw ? parseTenantHintInt(hRaw) : undefined;
  if (fromHeader !== undefined) return fromHeader;

  const body = req.body as { businessId?: unknown; shop?: unknown } | undefined;
  const b = body?.businessId;
  if (typeof b === "number" && Number.isInteger(b)) {
    const fb = parseTenantHintInt(String(b));
    if (fb !== undefined) return fb;
  }
  if (typeof b === "string") {
    const fb = parseTenantHintInt(b.trim());
    if (fb !== undefined) return fb;
  }
  const shopB = body?.shop;
  if (typeof shopB === "string") {
    const fs = parseTenantHintInt(shopB.trim());
    if (fs !== undefined) return fs;
  }

  return undefined;
}

export type BusinessSubscriptionGate = SubscriptionGateFields;

export function businessSubscriptionBlocked(
  business: BusinessSubscriptionGate,
  now = new Date(),
): boolean {
  return !isSubscriptionActive(business, now);
}

/**
 * Resolves tenant Business + Membership for `/api/*`.
 * Если пользователя или Membership ещё нет, но указан известный `businessId`,
 * считаем клиента витрины (CLIENT) — достаточно для GET /api/me без заказов.
 */
export async function businessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const skipPath = SKIP_PATH_PREFIXES.some(
    (p) => req.path === p || req.path.startsWith(`${p}/`),
  );
  if (skipPath) {
    next();
    return;
  }

  const path =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  if (isPublicStorefrontBookingPath(path)) {
    next();
    return;
  }

  const telegramId = telegramFromRequest(req);
  if (!telegramId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const hinted = businessIdHintFromRequest(req);

  try {
    if (hinted != undefined) {
      const business = await prisma.business.findUnique({ where: { id: hinted } });
      if (!business) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (isStorefrontClosedForCustomers(business)) {
        res.status(403).json({ error: API_ERR_STORE_UNAVAILABLE });
        return;
      }

      let userRow = await prisma.user.findUnique({ where: { telegramId } });

      const initDataRaw = trimmedHeader(req, "x-telegram-init-data");
      if (initDataRaw) {
        const webAppUser = parseTelegramWebAppUserFromInitData(initDataRaw);
        if (webAppUser?.id === telegramId) {
          userRow = await syncTelegramUserProfile({
            telegramId,
            username: webAppUser.username,
            firstName: webAppUser.firstName,
            lastName: webAppUser.lastName,
            photoUrl: webAppUser.photoUrl,
          });
          await acceptPendingStaffInvitesForUser({
            businessId: hinted,
            userId: userRow.id,
            telegramUsername: userRow.telegramUsername,
          });
        }
      }

      const staffRow =
        userRow == null
          ? null
          : await resolveBusinessStaffRecord(hinted, userRow.id);

      req.businessId = hinted;
      req.tenantBusiness = business;
      req.tenantUser = userRow;
      req.tenantStaff = staffRow;
      next();
      return;
    }

    const userRow = await prisma.user.findUnique({ where: { telegramId } });

    if (!userRow) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const staffRows = await prisma.businessStaff.findMany({
      where: { userId: userRow.id },
      include: { business: true },
      orderBy: { businessId: "asc" },
    });

    const businessIds = new Set<number>(staffRows.map((s) => s.businessId));

    if (businessIds.size === 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (businessIds.size > 1) {
      res.status(400).json({
        error: "Ambiguous tenant: send x-business-id header or shop query",
      });
      return;
    }

    const businessId = [...businessIds][0]!;
    const staff =
      staffRows.find((s) => s.businessId === businessId) ?? null;
    const business = staff?.business ?? null;
    if (!business) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (isStorefrontClosedForCustomers(business)) {
      res.status(403).json({ error: API_ERR_STORE_UNAVAILABLE });
      return;
    }

    req.businessId = businessId;
    req.tenantBusiness = business;
    req.tenantUser = userRow;
    req.tenantStaff = staff;
    next();
  } catch (e) {
    console.error("businessMiddleware:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
