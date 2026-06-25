import { emitStructuredLog } from "../../structuredLog.js";

export function logDeliveryRecoveryStarted(fields: {
  scanned: number;
  recovered: number;
  retried: number;
  deadLetter: number;
  durationMs: number;
}): void {
  emitStructuredLog("info", "delivery_recovery_started", fields);
}

export function logDeliveryRecovered(fields: {
  orderId: number;
  merchantId: number;
  internalStatus: string;
}): void {
  emitStructuredLog("info", "delivery_recovered", fields);
}

export function logDeliveryRetry(fields: {
  orderId: number;
  attempt: number;
  nextRetryAt: string;
  code: string;
}): void {
  emitStructuredLog("warn", "delivery_retry", fields);
}

export function logDeliveryDeadLetter(fields: {
  orderId: number;
  merchantId: number;
  retryCount: number;
  code: string;
}): void {
  emitStructuredLog("error", "delivery_dead_letter", fields);
}

export function logDeliveryHealthCheck(fields: {
  ok: boolean;
  activeCount: number;
  recoveringCount: number;
  failedCount: number;
}): void {
  emitStructuredLog("info", "delivery_health_check", fields);
}
