/**
 * Shared order analytics status semantics.
 * Keep this as single source of truth across merchant/admin analytics services.
 */

/**
 * DB-backed successful statuses for Prisma filters.
 * IMPORTANT: this list must contain only values that exist in Prisma OrderStatus.
 */
export const ORDER_ANALYTICS_SUCCESS_STATUSES_DB = [
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
] as const;

/**
 * Extended successful aliases for wire/legacy payload normalization.
 * `PAID` and `COMPLETED` are additive aliases used in analytics contracts.
 */
export const ORDER_ANALYTICS_SUCCESS_STATUS_ALIASES = [
  ...ORDER_ANALYTICS_SUCCESS_STATUSES_DB,
  "PAID",
  "COMPLETED",
] as const;

export const ORDER_ANALYTICS_EXCLUDED_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "PENDING",
  "FAILED",
  "CANCELLED",
  "DECLINED",
  "CREATED",
] as const;

const SUCCESS_SET = new Set<string>(ORDER_ANALYTICS_SUCCESS_STATUS_ALIASES);

export function normalizeOrderStatusForAnalytics(status: unknown): string {
  return String(status ?? "").trim().toUpperCase();
}

export function isOrderAnalyticsSuccessStatus(status: unknown): boolean {
  return SUCCESS_SET.has(normalizeOrderStatusForAnalytics(status));
}
