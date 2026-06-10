import type { NextFunction, Request, Response } from "express";

function timeoutMs(): number {
  const raw = process.env.REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 30_000;
  if (!Number.isFinite(n) || n < 1000) return 30_000;
  return Math.floor(n);
}

function isWebhookPath(pathname: string): boolean {
  return (
    pathname.startsWith("/webhook") ||
    pathname.startsWith("/telegram-webhook") ||
    pathname.startsWith("/finik")
  );
}

/** Request timeout for non-webhook routes (additive safety). */
export function requestTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const p =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;

  if (isWebhookPath(p)) {
    next();
    return;
  }

  const ms = timeoutMs();
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Превышено время ожидания запроса" });
    }
  }, ms);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
}
