import type { NextFunction, Request, Response } from "express";
import { requireTelegramAuth } from "./requireTelegramAuth.js";
import { logAuthReject } from "../server/structuredLog.js";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Legacy dev-only: x-telegram-id header when initData middleware was not applied. */
export function legacyTelegramIdFromRequest(req: Request): string | null {
  const rawXi = req.headers["x-telegram-id"];
  const xi =
    typeof rawXi === "string"
      ? rawXi.trim()
      : Array.isArray(rawXi) && typeof rawXi[0] === "string"
        ? rawXi[0].trim()
        : "";
  if (/^\d+$/.test(xi)) return xi;
  return null;
}

/**
 * Verified Telegram user id: only from `requireTelegramAuth`.
 * In production, never trusts query/body userId.
 */
export function verifiedTelegramIdFromRequest(req: Request): string | null {
  const fromAuth = req.platformTelegramId;
  if (typeof fromAuth === "string" && /^\d+$/.test(fromAuth)) {
    return fromAuth;
  }
  if (!isProduction()) {
    return legacyTelegramIdFromRequest(req);
  }
  return null;
}

/** Require signed Mini App initData; sets req.platformTelegramId. */
export async function requireVerifiedTelegram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireTelegramAuth(req, res, next);
}

/** Reject if no verified telegram id (after requireVerifiedTelegram). */
export function requireVerifiedTelegramId(
  req: Request,
  res: Response,
): string | null {
  const id = verifiedTelegramIdFromRequest(req);
  if (id) return id;
  logAuthReject({
    path: req.path ?? req.url,
    reason: "missing_verified_telegram_id",
    ...(req.ip ? { ip: req.ip } : {}),
  });
  res.status(401).json({
    error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
  });
  return null;
}
