import type { Request, Response } from "express";
import { verifiedTelegramIdFromRequest } from "../middleware/verifiedTelegramAuth.js";

function splitIds(raw: string | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(raw ?? "").split(/[,;\s]+/)) {
    const id = part.trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Platform operator IDs.
 * Priority: PLATFORM_OPERATOR_IDS, fallback: ADMIN_IDS + PLATFORM_ADMIN_TELEGRAM_ID.
 */
export function platformOperatorIdsFromEnv(): string[] {
  const preferred = splitIds(process.env.PLATFORM_OPERATOR_IDS);
  if (preferred.length > 0) return preferred;

  const fallback = splitIds(process.env.ADMIN_IDS);
  const single = String(process.env.PLATFORM_ADMIN_TELEGRAM_ID ?? "").trim();
  if (single !== "" && !fallback.includes(single)) fallback.push(single);
  return fallback;
}

function queryUserId(req: Request): string | undefined {
  const raw = req.query.userId;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

/** Platform operator id — verified initData only in production. */
export function adminUserIdFromRequest(req: Request): unknown {
  const verified = verifiedTelegramIdFromRequest(req);
  if (verified) return verified;
  if (process.env.NODE_ENV === "production") return undefined;
  const fromBody = req.body?.userId;
  if (fromBody !== undefined && fromBody !== null && String(fromBody).trim() !== "") {
    return fromBody;
  }
  return queryUserId(req);
}

export function isAdmin(userId: unknown): boolean {
  if (userId === undefined || userId === null || userId === "") return false;
  const str = String(userId).trim();
  if (!str) return false;
  const num = Number(str);
  if (Number.isFinite(num) && num <= 0) return false;
  const operatorIds = platformOperatorIdsFromEnv();
  if (operatorIds.length === 0) return false;
  if (operatorIds.includes(str)) return true;
  if (Number.isFinite(num) && operatorIds.includes(String(num))) return true;
  return false;
}

/** Explicit alias for operator checks in platform security layer. */
export function isPlatformOperator(userId: unknown): boolean {
  return isAdmin(userId);
}

/** Все admin endpoint: verified operator id. */
export function denyIfNotAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(adminUserIdFromRequest(req))) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}

/** GET и др.: verified operator id. */
export function denyIfNotAdminQuery(req: Request, res: Response): boolean {
  const userId = adminUserIdFromRequest(req);
  if (!isAdmin(userId)) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}
