import type { Request, Response } from "express";

const ADMIN_IDS = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "")
  : [];

function queryUserId(req: Request): string | undefined {
  const raw = req.query.userId;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

/** userId из JSON-тела или из query (на случай DELETE/прокси без тела). */
export function adminUserIdFromRequest(req: Request): unknown {
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
  if (ADMIN_IDS.length === 0) return false;
  if (ADMIN_IDS.includes(str)) return true;
  if (Number.isFinite(num) && ADMIN_IDS.includes(String(num))) return true;
  return false;
}

/** Все admin endpoint: `userId` в теле или в query. */
export function denyIfNotAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(adminUserIdFromRequest(req))) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}

/** GET и др.: `?userId=` */
export function denyIfNotAdminQuery(req: Request, res: Response): boolean {
  const userId = queryUserId(req);
  if (!isAdmin(userId)) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}
