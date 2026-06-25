import { emitStructuredLog } from "../../../../structuredLog.js";

export function logYandexDeliveryPriceCalculate(fields: {
  requestId?: string;
  correlationId?: string;
  merchantId: number;
  provider: "yandex";
  durationMs: number;
  ok: boolean;
  code?: string;
  httpStatus?: number;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "yandex_delivery_price_calculate", {
    merchantId: fields.merchantId,
    provider: fields.provider,
    durationMs: fields.durationMs,
    ok: fields.ok,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
    ...(fields.code ? { code: fields.code } : {}),
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
  });
}

export function logYandexDeliveryCalculateRouteError(fields: {
  path: string;
  correlationId?: string;
  errorCode: string;
}): void {
  emitStructuredLog("error", "yandex_delivery_calculate_route_error", {
    path: fields.path,
    errorCode: fields.errorCode,
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}
