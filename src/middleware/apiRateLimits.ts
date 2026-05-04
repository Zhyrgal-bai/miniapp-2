import type { Request } from "express";
import rateLimit from "express-rate-limit";

function logSuspicious(kind: string, req: Request): void {
  const path =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  console.warn(`[rate-limit:${kind}]`, {
    ip: req.ip ?? "",
    method: req.method,
    path,
  });
}

function skipTrustedPaymentWebhook(req: Request): boolean {
  if (req.method !== "POST") return false;
  const path =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  return path === "/api/payments/finik-webhook";
}

/** Лимит для всех путей под `/api/` (за исключением доверенного Finik webhook). */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_PER_MIN ?? 60) || 60,
  message: { error: "Слишком много запросов" },
  legacyHeaders: false,
  standardHeaders: "draft-7",
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  skip: skipTrustedPaymentWebhook,
  handler: (req, res, _next, options) => {
    logSuspicious("general", req);
    const msg =
      typeof options.message === "object"
        ? options.message
        : { error: String(options.message ?? "Too many requests") };
    res.status(options.statusCode).json(msg as object);
  },
});

/** Строже для дорогостоящих / чувствительных маршрутов платформы. */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_STRICT_PER_MIN ?? 10) || 10,
  message: { error: "Слишком много запросов" },
  legacyHeaders: false,
  standardHeaders: "draft-7",
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  skip: skipTrustedPaymentWebhook,
  handler: (req, res, _next, options) => {
    logSuspicious("strict", req);
    const msg =
      typeof options.message === "object"
        ? options.message
        : { error: String(options.message ?? "Too many requests") };
    res.status(options.statusCode).json(msg as object);
  },
});
