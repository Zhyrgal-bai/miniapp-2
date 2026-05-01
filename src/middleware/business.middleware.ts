import type { NextFunction, Request, Response } from "express";
import type { Business, Membership, User } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../server/db.js";
import { isSubscriptionFullyExpired } from "../server/subscriptionMaintenance.js";

declare global {
  namespace Express {
    interface Request {
      businessId?: number;
      tenantUser?: User | null;
      tenantBusiness?: Business;
      tenantMembership?: Membership | null;
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
  const h = trimmedHeader(req, "x-telegram-id");
  if (h) return h;
  const body = req.body as { userId?: unknown } | undefined;
  const fromBody =
    typeof body?.userId === "string" || typeof body?.userId === "number"
      ? String(body.userId).trim()
      : "";
  if (fromBody) return fromBody;
  const q = req.query.userId;
  const qs = typeof q === "string" ? q : Array.isArray(q) ? String(q[0]) : "";
  const t = qs.trim();
  return t === "" ? null : t;
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

export function businessSubscriptionBlocked(business: Business, now = new Date()): boolean {
  if (!business.isActive) return true;

  if (
    business.subscriptionStatus === SubscriptionStatus.EXPIRED ||
    business.subscriptionStatus === SubscriptionStatus.CANCELED
  ) {
    return true;
  }

  if (business.subscriptionStatus === SubscriptionStatus.PAST_DUE) {
    return true;
  }

  if (
    isSubscriptionFullyExpired(
      {
        trialEndsAt: business.trialEndsAt,
        subscriptionEndsAt: business.subscriptionEndsAt,
      },
      now,
    )
  ) {
    return true;
  }

  return false;
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
      if (businessSubscriptionBlocked(business)) {
        res.status(403).json({ error: "Subscription expired" });
        return;
      }

      const userRow = await prisma.user.findUnique({ where: { telegramId } });

      const membershipRow =
        userRow == null
          ? null
          : await prisma.membership.findUnique({
              where: {
                userId_businessId: { userId: userRow.id, businessId: hinted },
              },
            });

      req.businessId = hinted;
      req.tenantBusiness = business;
      req.tenantUser = userRow;
      req.tenantMembership = membershipRow;
      next();
      return;
    }

    const userRow = await prisma.user.findUnique({ where: { telegramId } });

    if (!userRow) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: userRow.id },
      include: { business: true },
      orderBy: { businessId: "asc" },
    });

    if (memberships.length === 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (memberships.length > 1) {
      res.status(400).json({
        error: "Ambiguous tenant: send x-business-id header or shop query",
      });
      return;
    }

    const only = memberships[0]!;
    if (businessSubscriptionBlocked(only.business)) {
      res.status(403).json({ error: "Subscription expired" });
      return;
    }

    req.businessId = only.businessId;
    req.tenantBusiness = only.business;
    req.tenantUser = userRow;
    req.tenantMembership = only;
    next();
  } catch (e) {
    console.error("businessMiddleware:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
