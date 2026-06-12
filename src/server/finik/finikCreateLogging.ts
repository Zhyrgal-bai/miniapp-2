import { emitStructuredLog } from "../structuredLog.js";
import type {
  FinikCreateApiMode,
  FinikCreateApiModeUsed,
  FinikCreateContext,
  FinikCreateResult,
} from "./finikCreateTypes.js";

export function logFinikCreateAttempt(fields: {
  configuredMode: FinikCreateApiMode;
  selectedAdapter: FinikCreateApiModeUsed;
  flow: FinikCreateContext["flow"];
  businessId?: number;
  correlationId?: string;
}): void {
  emitStructuredLog("info", "finik_create_attempt", {
    configuredMode: fields.configuredMode,
    selectedAdapter: fields.selectedAdapter,
    flow: fields.flow,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}

export function logFinikCreateResult(fields: {
  configuredMode: FinikCreateApiMode;
  apiMode: FinikCreateApiModeUsed;
  flow: FinikCreateContext["flow"];
  ok: boolean;
  businessId?: number;
  correlationId?: string;
  httpStatus?: number;
  errorCode?: string;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "finik_create_result", {
    configuredMode: fields.configuredMode,
    apiMode: fields.apiMode,
    flow: fields.flow,
    ok: fields.ok,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
    ...(fields.httpStatus != null ? { httpStatus: fields.httpStatus } : {}),
    ...(fields.errorCode ? { errorCode: fields.errorCode } : {}),
  });
}

export function logFinikCreateHttpError(fields: {
  apiMode: FinikCreateApiModeUsed;
  flow: FinikCreateContext["flow"];
  httpStatus: number;
  correlationId?: string;
}): void {
  emitStructuredLog("error", "finik_create_http_error", {
    apiMode: fields.apiMode,
    flow: fields.flow,
    httpStatus: fields.httpStatus,
    ...(fields.correlationId ? { correlationId: fields.correlationId } : {}),
  });
}

export function logFinikStatusAttempt(fields: {
  apiMode: "official" | "legacy";
  businessId?: number;
  paymentId: string;
  path: string;
  orderId?: number;
}): void {
  emitStructuredLog("info", "finik_status_attempt", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    path: fields.path,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikStatusHttpError(fields: {
  apiMode: "official" | "legacy";
  httpStatus: number;
  paymentId: string;
  path: string;
  businessId?: number;
  orderId?: number;
}): void {
  emitStructuredLog("error", "finik_status_http_error", {
    apiMode: fields.apiMode,
    httpStatus: fields.httpStatus,
    paymentId: fields.paymentId,
    path: fields.path,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikStatusResult(fields: {
  apiMode: "official" | "legacy";
  ok: boolean;
  paymentId: string;
  status?: string;
  businessId?: number;
  orderId?: number;
}): void {
  emitStructuredLog(fields.ok ? "info" : "warn", "finik_status_result", {
    apiMode: fields.apiMode,
    ok: fields.ok,
    paymentId: fields.paymentId,
    ...(fields.status ? { status: fields.status } : {}),
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikOrderPaymentSync(fields: {
  phase: "start" | "status_fetched" | "apply_success" | "apply_failed";
  businessId: number;
  orderId: number;
  paymentId?: string;
  paymentState?: string;
  error?: string;
}): void {
  emitStructuredLog("info", "finik_order_payment_sync", {
    phase: fields.phase,
    businessId: fields.businessId,
    orderId: fields.orderId,
    ...(fields.paymentId ? { paymentId: fields.paymentId } : {}),
    ...(fields.paymentState ? { paymentState: fields.paymentState } : {}),
    ...(fields.error ? { error: fields.error } : {}),
  });
}
