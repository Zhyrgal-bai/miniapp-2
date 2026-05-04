import express from "express";
import type { NextFunction, Request, Response } from "express";

const jsonLargeLimit = express.json({
  limit: process.env.API_JSON_BODY_LIMIT_LARGE?.trim() || "512kb",
});
const jsonSmallLimit = express.json({
  limit: process.env.API_JSON_BODY_LIMIT?.trim() || "10kb",
});

/** Вебхуки и платёжные callback могут прислать больший JSON; остальной API — 10kb по умолчанию. */
function wantsLargeJsonBody(pathname: string): boolean {
  if (pathname.startsWith("/webhook") || pathname.startsWith("/telegram-webhook")) {
    return true;
  }
  if (pathname.startsWith("/finik")) {
    return true;
  }
  if (pathname === "/api/payments/finik-webhook") {
    return true;
  }
  return false;
}

export function jsonBodyLimits(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const p =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  (wantsLargeJsonBody(p) ? jsonLargeLimit : jsonSmallLimit)(req, res, next);
}
