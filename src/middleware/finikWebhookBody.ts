import express from "express";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

function pathname(req: Request): string {
  const p =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  return p.split("?")[0] ?? p;
}

function isFinikWebhookPost(req: Request): boolean {
  if (req.method !== "POST") return false;
  const p = pathname(req);
  return (
    p === "/finik/webhook" ||
    p.startsWith("/finik/webhook/") ||
    p === "/api/platform/subscription-finik-webhook"
  );
}

const rawParser = express.raw({
  type: () => true,
  limit: process.env.API_JSON_BODY_LIMIT_LARGE?.trim() || "512kb",
});

/** Capture raw bytes for Finik HMAC before JSON parser runs. */
export function finikWebhookRawBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isFinikWebhookPost(req)) {
    next();
    return;
  }

  rawParser(req, res, (err: unknown) => {
    if (err) {
      next(err);
      return;
    }
    const buf = req.body;
    const raw = Buffer.isBuffer(buf)
      ? buf.toString("utf8")
      : typeof buf === "string"
        ? buf
        : "";
    req.rawBody = raw;
    if (raw.trim() === "") {
      req.body = {};
      next();
      return;
    }
    try {
      req.body = JSON.parse(raw) as unknown;
    } catch {
      req.body = {};
    }
    next();
  });
}
