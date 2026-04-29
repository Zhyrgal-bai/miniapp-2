import type { NextFunction, Request, Response } from "express";
import type { Business, User } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../server/db.js";
import { isSubscriptionFullyExpired } from "../server/subscriptionMaintenance.js";

declare global {
  namespace Express {
    interface Request {
      businessId?: number;
      tenantUser?: User;
      tenantBusiness?: Business;
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

function telegramFromRequest(req: Request): string | undefined {
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
  return t === "" ? undefined : t;
}

function businessIdHintFromRequest(req: Request): number | undefined {
  const hRaw = trimmedHeader(req, "x-business-id");
  if (hRaw) {
    const n = Number(hRaw);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const body = req.body as { businessId?: unknown } | undefined;
  if (typeof body?.businessId === "number") {
    return Number.isInteger(body.businessId) && body.businessId > 0
      ? body.businessId
      : undefined;
  }
  if (typeof body?.businessId === "string") {
    const n = Number(body.businessId);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }
  const shopRaw = req.query.shop;
  const sq =
    typeof shopRaw === "string"
      ? shopRaw
      : Array.isArray(shopRaw)
        ? String(shopRaw[0] ?? "")
        : "";
  const shop = Number(sq);
  return Number.isInteger(shop) && shop > 0 ? shop : undefined;
}

/**
 * After trial or paid entitlement ends — block API access when tenant isn't allowed to operate.
 * Aligns with `subscriptionMaintenance` auto-expire rules.
 */
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
      now
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves tenant + user via compound unique `[businessId, telegramId]` (see Prisma schema).
 * Accepts tenant hint from `x-business-id`, `?shop=` or JSON `businessId`.
 */
export async function businessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const skipPath = SKIP_PATH_PREFIXES.some(
    (p) => req.path === p || req.path.startsWith(`${p}/`)
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
    if (hinted != null) {
      const user = await prisma.user.findUnique({
        where: {
          businessId_telegramId: { businessId: hinted, telegramId },
        },
        include: { business: true },
      });
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (businessSubscriptionBlocked(user.business)) {
        res.status(403).json({ error: "Subscription expired" });
        return;
      }
      req.businessId = user.businessId;
      req.tenantUser = user;
      req.tenantBusiness = user.business;
      next();
      return;
    }

    const candidates = await prisma.user.findMany({
      where: { telegramId },
      include: { business: true },
    });

    if (candidates.length === 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (candidates.length > 1) {
      res.status(400).json({
        error: "Ambiguous tenant: send x-business-id header or shop query",
      });
      return;
    }

    const only = candidates[0]!;
    if (businessSubscriptionBlocked(only.business)) {
      res.status(403).json({ error: "Subscription expired" });
      return;
    }

    req.businessId = only.businessId;
    req.tenantUser = only;
    req.tenantBusiness = only.business;
    next();
  } catch (e) {
    console.error("businessMiddleware:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
