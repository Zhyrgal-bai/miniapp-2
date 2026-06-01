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
