import {
  getDeliveryRecoveryMaxAttempts,
  getDeliveryRecoveryRetryBaseMs,
  getDeliveryRecoveryRetryMaxMs,
} from "../services/deliveryRecoveryConfig.js";

export type ProviderErrorCode =
  | "validation_error"
  | "timeout"
  | "network_error"
  | "rate_limited"
  | "api_error"
  | "not_configured"
  | string;

const NON_RETRYABLE_HTTP = new Set([400, 401, 403, 404]);
const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

export function isRetryableProviderError(
  code: ProviderErrorCode,
  httpStatus?: number,
): boolean {
  if (code === "timeout" || code === "network_error" || code === "rate_limited") {
    return true;
  }
  if (httpStatus != null) {
    if (NON_RETRYABLE_HTTP.has(httpStatus)) return false;
    if (RETRYABLE_HTTP.has(httpStatus)) return true;
  }
  if (code === "api_error" && httpStatus == null) return true;
  return false;
}

export function computeNextRetryAt(attempt: number, now = new Date()): Date {
  const baseMs = getDeliveryRecoveryRetryBaseMs();
  const maxMs = getDeliveryRecoveryRetryMaxMs();
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  const delayMs = Math.min(exp + jitter, maxMs);
  return new Date(now.getTime() + delayMs);
}

export function shouldMoveToDeadLetter(attempt: number): boolean {
  return attempt >= getDeliveryRecoveryMaxAttempts();
}

export function getRecoveryMaxAttempts(): number {
  return getDeliveryRecoveryMaxAttempts();
}
