import { emitStructuredLog } from "../../../../structuredLog.js";
import { sanitizeEndpointPath } from "./yandexLogSanitize.js";

export function logYandexDeliveryRequest(fields: {
  requestId: string;
  method: string;
  endpoint: string;
  attempt: number;
  correlationId?: string;
}): void {
  emitStructuredLog("info", "yandex_delivery_request", {
    requestId: fields.requestId,
    method: fields.method,
    endpoint: sanitizeEndpointPath(fields.endpoint),
    attempt: fields.attempt,
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}

export function logYandexDeliveryResponse(fields: {
  requestId: string;
  method: string;
  endpoint: string;
  httpStatus?: number;
  durationMs: number;
  attempt: number;
  ok: boolean;
  retryable?: boolean;
  errorKind?: string;
  correlationId?: string;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "yandex_delivery_response", {
    requestId: fields.requestId,
    method: fields.method,
    endpoint: sanitizeEndpointPath(fields.endpoint),
    durationMs: fields.durationMs,
    attempt: fields.attempt,
    ok: fields.ok,
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
    ...(fields.retryable != null ? { retryable: fields.retryable } : {}),
    ...(fields.errorKind ? { errorKind: fields.errorKind } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}

export function logYandexDeliveryRouteError(fields: {
  path: string;
  correlationId?: string;
  errorCode: string;
}): void {
  emitStructuredLog("error", "yandex_delivery_route_error", {
    path: fields.path,
    errorCode: fields.errorCode,
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}
