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

function makeLimiter(opts: {
  limit: number;
  kind: string;
  skip?: (req: Request) => boolean;
}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: opts.limit,
    message: { error: "Слишком много запросов" },
    legacyHeaders: false,
    standardHeaders: "draft-7",
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    skip: (req) =>
      skipTrustedPaymentWebhook(req) || (opts.skip?.(req) ?? false),
    handler: (req, res, _next, options) => {
      logSuspicious(opts.kind, req);
      const msg =
        typeof options.message === "object"
          ? options.message
          : { error: String(options.message ?? "Too many requests") };
      res.status(options.statusCode).json(msg as object);
    },
  });
}

/** Лимит для всех путей под `/api/` (за исключением доверенного Finik webhook). */
export const apiLimiter = makeLimiter({
  limit: Number(process.env.API_RATE_LIMIT_PER_MIN ?? 60) || 60,
  kind: "general",
});

/** Строже для дорогостоящих / чувствительных маршрутов платформы. */
export const strictLimiter = makeLimiter({
  limit: Number(process.env.API_RATE_LIMIT_STRICT_PER_MIN ?? 10) || 10,
  kind: "strict",
});

/** Checkout — вне `/api/` prefix. */
export const ordersLimiter = makeLimiter({
  limit: Number(process.env.ORDERS_RATE_LIMIT_PER_MIN ?? 20) || 20,
  kind: "orders",
});

/** Merchant mutations (products, orders admin, settings). */
export const merchantMutationLimiter = makeLimiter({
  limit: Number(process.env.MERCHANT_MUTATION_RATE_LIMIT_PER_MIN ?? 40) || 40,
  kind: "merchant_mutation",
});

/** Finik + Telegram webhooks. */
export const webhooksLimiter = makeLimiter({
  limit: Number(process.env.WEBHOOKS_RATE_LIMIT_PER_MIN ?? 120) || 120,
  kind: "webhooks",
});

/** Support customer + merchant actions. */
export const supportLimiter = makeLimiter({
  limit: Number(process.env.SUPPORT_RATE_LIMIT_PER_MIN ?? 30) || 30,
  kind: "support",
});
