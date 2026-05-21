import type { Request, Response, NextFunction } from "express";
import { requireVerifiedTelegram } from "./verifiedTelegramAuth.js";

const MERCHANT_WRITE_PREFIXES = [
  "/products",
  "/categories",
  "/settings",
  "/payment",
  "/promo",
  "/analytics",
  "/order/status",
  "/orders/",
  "/upload",
  "/merchant/",
  "/integrations/",
];

const MERCHANT_WRITE_EXACT = new Set([
  "/orders/clear",
  "/connect-bot",
  "/check-admin",
]);

function normalizedPath(req: Request): string {
  const p =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  return p.split("?")[0] ?? p;
}

export function routeRequiresVerifiedTelegram(req: Request): boolean {
  const method = req.method.toUpperCase();
  const path = normalizedPath(req);

  if (path.startsWith("/api/platform")) return true;

  if (
    method === "GET" &&
    (path === "/my-businesses" || path === "/api/my-businesses")
  ) {
    return true;
  }

  if (path.startsWith("/api/") && !path.startsWith("/api/storefront/")) {
    if (path.startsWith("/api/business/") && method === "GET") return false;
    if (path.startsWith("/api/telemetry/")) return false;
    return method !== "GET" || path.includes("/staff");
  }

  if (path.startsWith("/integrations/")) return true;

  if (method === "POST" && path === "/orders") return true;
  if (path.startsWith("/support/")) return true;

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    if (path === "/products" || /^\/products\/\d+$/.test(path)) return false;
    if (path === "/categories") return false;
    return false;
  }

  if (MERCHANT_WRITE_EXACT.has(path)) return true;
  for (const prefix of MERCHANT_WRITE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix)) {
      return true;
    }
  }
  if (path.startsWith("/orders")) return true;

  return false;
}

/** Express middleware: verified Telegram initData on privileged routes. */
export async function verifiedTelegramGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!routeRequiresVerifiedTelegram(req)) {
    next();
    return;
  }
  await requireVerifiedTelegram(req, res, next);
}

/** Merchant/admin mutations (non-GET) that share verified-telegram route set. */
export function routeRequiresMerchantMutationLimiter(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return false;
  }
  return routeRequiresVerifiedTelegram(req);
}
