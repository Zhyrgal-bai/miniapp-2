import { emitStructuredLog } from "../../../../structuredLog.js";

function hashClaimId(claimId: string): string {
  const trimmed = claimId.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function logDeliveryWebhookReceived(fields: {
  claimIdHash: string;
  updatedTs?: string;
  durationMs: number;
}): void {
  emitStructuredLog("info", "delivery_webhook_received", {
    claimIdHash: fields.claimIdHash,
    durationMs: fields.durationMs,
    ...(fields.updatedTs ? { updatedTs: fields.updatedTs } : {}),
  });
}

export function logDeliveryStatusUpdated(fields: {
  orderId: number;
  merchantId: number;
  internalStatus: string;
  providerStatus: string;
}): void {
  emitStructuredLog("info", "delivery_status_updated", {
    orderId: fields.orderId,
    merchantId: fields.merchantId,
    internalStatus: fields.internalStatus,
    providerStatus: fields.providerStatus,
  });
}

export function logDeliveryTrackingUpdated(fields: {
  orderId: number;
  hasCourier: boolean;
  hasEta: boolean;
}): void {
  emitStructuredLog("info", "delivery_tracking_updated", {
    orderId: fields.orderId,
    hasCourier: fields.hasCourier,
    hasEta: fields.hasEta,
  });
}

export function logDeliveryWebhookFailed(fields: {
  code: string;
  httpStatus?: number;
  claimId?: string;
}): void {
  emitStructuredLog("warn", "delivery_webhook_failed", {
    code: fields.code,
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
    ...(fields.claimId ? { claimIdHash: hashClaimId(fields.claimId) } : {}),
  });
}

export { hashClaimId };
