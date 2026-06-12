import { emitStructuredLog } from "../structuredLog.js";
import type {
  FinikCreateApiMode,
  FinikCreateApiModeUsed,
  FinikCreateContext,
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
  url: string;
  httpMethod: string;
  orderId?: number;
}): void {
  emitStructuredLog("info", "finik_status_attempt", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    url: fields.url,
    httpMethod: fields.httpMethod,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikStatusResponse(fields: {
  apiMode: "official" | "legacy";
  businessId?: number;
  paymentId: string;
  url: string;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  rawBodyPreview: string;
  jsonParseSucceeded: boolean;
  orderId?: number;
}): void {
  emitStructuredLog("info", "finik_status_response", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    url: fields.url,
    httpStatus: fields.httpStatus,
    responseHeaders: fields.responseHeaders,
    rawBodyPreview: fields.rawBodyPreview,
    jsonParseSucceeded: fields.jsonParseSucceeded,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikStatusSigningFailed(fields: {
  apiMode: "official" | "legacy";
  businessId?: number;
  paymentId: string;
  url: string;
  errorMessage: string;
  errorStack?: string;
  orderId?: number;
}): void {
  emitStructuredLog("error", "finik_status_signing_failed", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    url: fields.url,
    errorMessage: fields.errorMessage,
    ...(fields.errorStack ? { errorStack: fields.errorStack } : {}),
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export function logFinikStatusParseFailed(fields: {
  apiMode: "official" | "legacy";
  businessId?: number;
  paymentId: string;
  url: string;
  httpStatus: number;
  parsedJson: Record<string, unknown>;
  candidateStatusFields: Record<string, unknown>;
  extractedStatus: string;
  orderId?: number;
}): void {
  emitStructuredLog("warn", "finik_status_parse_failed", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    url: fields.url,
    httpStatus: fields.httpStatus,
    parsedJson: fields.parsedJson,
    candidateStatusFields: fields.candidateStatusFields,
    extractedStatus: fields.extractedStatus,
    ...(fields.businessId != null ? { businessId: fields.businessId } : {}),
    ...(fields.orderId != null ? { orderId: fields.orderId } : {}),
  });
}

export type FinikStatusAdapterAttempt = {
  url: string;
  httpStatus?: number;
  reason: "http_error" | "parse_failed" | "signing_failed" | "network_error";
  missingAuthToken?: boolean;
};

export function logFinikStatusAdapterFailed(fields: {
  apiMode: "official" | "legacy";
  businessId?: number;
  paymentId: string;
  attempts: readonly FinikStatusAdapterAttempt[];
  finalReason: string;
  orderId?: number;
}): void {
  emitStructuredLog("error", "finik_status_adapter_failed", {
    apiMode: fields.apiMode,
    paymentId: fields.paymentId,
    attemptedUrls: fields.attempts.map((a) => a.url),
    attemptHttpStatuses: fields.attempts.map((a) => a.httpStatus ?? null),
    attemptReasons: fields.attempts.map((a) => a.reason),
    finalReason: fields.finalReason,
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
  paymentMethod?: string | null;
  paymentState?: string;
  successMapping?: "paid" | "pending" | "failed";
  oldStatus?: string;
  newStatus?: string;
  error?: string;
}): void {
  emitStructuredLog("info", "finik_order_payment_sync", {
    phase: fields.phase,
    businessId: fields.businessId,
    orderId: fields.orderId,
    ...(fields.paymentId ? { paymentId: fields.paymentId } : {}),
    ...(fields.paymentMethod != null
      ? { paymentMethod: fields.paymentMethod }
      : {}),
    ...(fields.paymentState ? { paymentState: fields.paymentState } : {}),
    ...(fields.successMapping ? { successMapping: fields.successMapping } : {}),
    ...(fields.oldStatus ? { oldStatus: fields.oldStatus } : {}),
    ...(fields.newStatus ? { newStatus: fields.newStatus } : {}),
    ...(fields.error ? { error: fields.error } : {}),
  });
}
