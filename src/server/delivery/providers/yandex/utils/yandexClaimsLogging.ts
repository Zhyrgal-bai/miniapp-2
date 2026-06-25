import { emitStructuredLog } from "../../../../structuredLog.js";

export function logDeliveryClaimCreate(fields: {
  requestId?: string;
  correlationId?: string;
  merchantId: number;
  orderId: number;
  provider: "yandex";
  durationMs: number;
  ok: boolean;
  status?: string;
  code?: string;
  httpStatus?: number;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "delivery_claim_create", {
    merchantId: fields.merchantId,
    orderId: fields.orderId,
    provider: fields.provider,
    durationMs: fields.durationMs,
    ok: fields.ok,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
    ...(fields.status ? { status: fields.status } : {}),
    ...(fields.code ? { code: fields.code } : {}),
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
  });
}

export function logDeliveryClaimAccept(fields: {
  requestId?: string;
  correlationId?: string;
  merchantId: number;
  orderId: number;
  provider: "yandex";
  durationMs: number;
  ok: boolean;
  status?: string;
  code?: string;
  httpStatus?: number;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "delivery_claim_accept", {
    merchantId: fields.merchantId,
    orderId: fields.orderId,
    provider: fields.provider,
    durationMs: fields.durationMs,
    ok: fields.ok,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
    ...(fields.status ? { status: fields.status } : {}),
    ...(fields.code ? { code: fields.code } : {}),
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
  });
}

export function logDeliveryClaimFailed(fields: {
  requestId?: string;
  correlationId?: string;
  merchantId: number;
  orderId: number;
  provider: "yandex";
  code: string;
  phase: "create" | "accept" | "fulfillment";
}): void {
  emitStructuredLog("error", "delivery_claim_failed", {
    merchantId: fields.merchantId,
    orderId: fields.orderId,
    provider: fields.provider,
    code: fields.code,
    phase: fields.phase,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}

export function logDeliveryFulfillmentError(fields: {
  orderId: number;
  errorCode: string;
}): void {
  emitStructuredLog("error", "delivery_fulfillment_error", {
    orderId: fields.orderId,
    errorCode: fields.errorCode,
  });
}
