import {
  getOfficialAcquiringBaseUrl,
  listOfficialAcquiringStatusPaths,
} from "./finikCreateConfig.js";
import { getFinikApiKey } from "./finikKeys.js";
import {
  logFinikStatusAdapterFailed,
  logFinikStatusAttempt,
  logFinikStatusHttpError,
  logFinikStatusParseFailed,
  logFinikStatusResponse,
  logFinikStatusResult,
  logFinikStatusSigningFailed,
  type FinikStatusAdapterAttempt,
} from "./finikCreateLogging.js";
import {
  isFinikPlatformManagedMerchantsEnabled,
  isMerchantFinikPlatformManaged,
} from "./resolveFinikTenantCredentials.js";
import { signFinikOfficialGetRequest } from "./finikRsaSigning.js";
import {
  diagnoseFinikPaymentStatusParse,
  normalizeFinikPaymentStatusResponse,
} from "./finikStatusResponseNormalizer.js";
import type {
  FinikPaymentStatusResult,
  FinikStatusBusinessCredentials,
} from "./finikStatusTypes.js";

const RAW_BODY_PREVIEW_MAX = 500;

function officialAcquiringHost(): string {
  return new URL(getOfficialAcquiringBaseUrl()).host;
}

function resolveOfficialApiKey(business: FinikStatusBusinessCredentials): string {
  if (
    isFinikPlatformManagedMerchantsEnabled() &&
    isMerchantFinikPlatformManaged({
      finikApiKey: business.finikApiKey,
      finikAccountId: business.finikAccountId,
      finikSecret: business.finikSecret,
    })
  ) {
    return getFinikApiKey();
  }
  const k = business.finikApiKey?.trim() ?? "";
  if (k !== "") return k;
  return getFinikApiKey();
}

function pickResponseHeaders(res: Response): Record<string, string> {
  const keys = [
    "content-type",
    "content-length",
    "location",
    "x-request-id",
    "x-amzn-requestid",
    "x-amz-request-id",
  ] as const;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = res.headers.get(key);
    if (v != null && v.trim() !== "") {
      out[key] = v.trim();
    }
  }
  return out;
}

function previewRawBody(raw: string): string {
  if (raw.length <= RAW_BODY_PREVIEW_MAX) return raw;
  return `${raw.slice(0, RAW_BODY_PREVIEW_MAX)}…`;
}

async function fetchOfficialStatusAtPath(input: {
  path: string;
  apiKey: string;
  host: string;
  paymentId: string;
  businessId?: number;
  orderId?: number;
}): Promise<
  | { ok: true; status: string; amount: number | null; path: string; url: string }
  | {
      ok: false;
      httpStatus?: number;
      path: string;
      url: string;
      reason: FinikStatusAdapterAttempt["reason"];
      missingAuthToken?: boolean;
    }
> {
  const url = `${getOfficialAcquiringBaseUrl()}${input.path}`;
  const httpMethod = "GET";
  const logCtx = {
    apiMode: "official" as const,
    paymentId: input.paymentId,
    url,
    httpMethod,
    ...(input.businessId != null ? { businessId: input.businessId } : {}),
    ...(input.orderId != null ? { orderId: input.orderId } : {}),
  };

  logFinikStatusAttempt(logCtx);

  let signature: string;
  let timestamp: string;
  try {
    ({ signature, timestamp } = await signFinikOfficialGetRequest({
      host: input.host,
      path: input.path,
      apiKey: input.apiKey,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logFinikStatusSigningFailed({
      apiMode: "official",
      paymentId: input.paymentId,
      url,
      errorMessage: message,
      ...(stack ? { errorStack: stack } : {}),
      ...(input.businessId != null ? { businessId: input.businessId } : {}),
      ...(input.orderId != null ? { orderId: input.orderId } : {}),
    });
    return { ok: false, path: input.path, url, reason: "signing_failed" };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: httpMethod,
      headers: {
        "x-api-key": input.apiKey,
        "x-api-timestamp": timestamp,
        signature,
      },
    });
  } catch {
    return {
      ok: false,
      path: input.path,
      url,
      reason: "network_error",
    };
  }

  const rawBody = await res.text();
  let jsonParseSucceeded = false;
  let json: Record<string, unknown> = {};
  if (rawBody.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
        jsonParseSucceeded = true;
      }
    } catch {
      jsonParseSucceeded = false;
    }
  } else {
    jsonParseSucceeded = true;
  }

  logFinikStatusResponse({
    apiMode: "official",
    paymentId: input.paymentId,
    url,
    httpStatus: res.status,
    responseHeaders: pickResponseHeaders(res),
    rawBodyPreview: previewRawBody(rawBody),
    jsonParseSucceeded,
    ...(input.businessId != null ? { businessId: input.businessId } : {}),
    ...(input.orderId != null ? { orderId: input.orderId } : {}),
  });

  if (!res.ok) {
    logFinikStatusHttpError({
      apiMode: "official",
      httpStatus: res.status,
      paymentId: input.paymentId,
      path: input.path,
      ...(input.businessId != null ? { businessId: input.businessId } : {}),
      ...(input.orderId != null ? { orderId: input.orderId } : {}),
    });
    const missingAuthToken =
      res.status === 403 &&
      (rawBody.includes("Missing Authentication Token") ||
        String(json.message ?? json.Message ?? "").includes(
          "Missing Authentication Token",
        ));
    return {
      ok: false,
      httpStatus: res.status,
      path: input.path,
      url,
      reason: "http_error",
      ...(missingAuthToken ? { missingAuthToken: true } : {}),
    };
  }

  const parsed = normalizeFinikPaymentStatusResponse(json);
  if (parsed.status === "") {
    const diagnosis = diagnoseFinikPaymentStatusParse(json);
    logFinikStatusParseFailed({
      apiMode: "official",
      paymentId: input.paymentId,
      url,
      httpStatus: res.status,
      parsedJson: json,
      candidateStatusFields: diagnosis.candidateStatusFields,
      extractedStatus: diagnosis.extractedStatus,
      ...(input.businessId != null ? { businessId: input.businessId } : {}),
      ...(input.orderId != null ? { orderId: input.orderId } : {}),
    });
    return {
      ok: false,
      httpStatus: res.status,
      path: input.path,
      url,
      reason: "parse_failed",
    };
  }

  return {
    ok: true,
    status: parsed.status,
    amount: parsed.amount,
    path: input.path,
    url,
  };
}

export type OfficialFinikStatusQueryContext = {
  businessId?: number;
  orderId?: number;
};

/**
 * Official Finik Acquiring GET payment status (RSA-SHA256).
 * @see https://telegra.ph/Finikkg-09-10 — webhook documented; GET inferred as GET /v1/payment/{PaymentId}
 */
export async function fetchOfficialFinikPaymentStatus(
  business: FinikStatusBusinessCredentials,
  paymentId: string,
  queryContext?: OfficialFinikStatusQueryContext,
): Promise<FinikPaymentStatusResult> {
  const pid = paymentId.trim();
  if (pid === "") {
    return { ok: false, error: "paymentId required", apiMode: "official" };
  }

  const apiKey = resolveOfficialApiKey(business);
  if (apiKey === "") {
    return {
      ok: false,
      error:
        "Finik Official: не задан API Key (магазин или FINIK_API_KEY)",
      apiMode: "official",
    };
  }

  const host = officialAcquiringHost();
  const paths = listOfficialAcquiringStatusPaths(pid);
  const attempts: FinikStatusAdapterAttempt[] = [];
  let lastHttpStatus: number | undefined;

  try {
    for (const path of paths) {
      const out = await fetchOfficialStatusAtPath({
        path,
        apiKey,
        host,
        paymentId: pid,
        ...(queryContext?.businessId != null
          ? { businessId: queryContext.businessId }
          : {}),
        ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
      });
      if (out.ok) {
        logFinikStatusResult({
          apiMode: "official",
          ok: true,
          paymentId: pid,
          status: out.status,
          ...(queryContext?.businessId != null
            ? { businessId: queryContext.businessId }
            : {}),
          ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
        });
        return {
          ok: true,
          status: out.status,
          amount: out.amount,
          apiMode: "official",
        };
      }
      attempts.push({
        url: out.url,
        ...(out.httpStatus != null ? { httpStatus: out.httpStatus } : {}),
        reason: out.reason,
        ...(out.missingAuthToken ? { missingAuthToken: true } : {}),
      });
      if (out.httpStatus != null) {
        lastHttpStatus = out.httpStatus;
      }
      if (out.reason === "network_error") {
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logFinikStatusAdapterFailed({
      apiMode: "official",
      paymentId: pid,
      attempts,
      finalReason: `network_error:${message}`,
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    logFinikStatusResult({
      apiMode: "official",
      ok: false,
      paymentId: pid,
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    return {
      ok: false,
      error: "Ошибка сети при запросе статуса Finik Official API",
      apiMode: "official",
      retryable: true,
    };
  }

  if (attempts.some((a) => a.reason === "network_error")) {
    logFinikStatusAdapterFailed({
      apiMode: "official",
      paymentId: pid,
      attempts,
      finalReason: "network_error",
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    logFinikStatusResult({
      apiMode: "official",
      ok: false,
      paymentId: pid,
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    return {
      ok: false,
      error: "Ошибка сети при запросе статуса Finik Official API",
      apiMode: "official",
      retryable: true,
    };
  }

  const httpErrors = attempts.filter((a) => a.reason === "http_error");
  const allMissingAuthToken =
    httpErrors.length > 0 &&
    httpErrors.every((a) => a.missingAuthToken === true);

  if (allMissingAuthToken) {
    logFinikStatusAdapterFailed({
      apiMode: "official",
      paymentId: pid,
      attempts,
      finalReason: "official_get_not_supported",
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    logFinikStatusResult({
      apiMode: "official",
      ok: false,
      paymentId: pid,
      ...(queryContext?.businessId != null
        ? { businessId: queryContext.businessId }
        : {}),
      ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
    });
    return {
      ok: false,
      error:
        "Finik Official: статус платежа подтверждается через webhook (GET status API недоступен)",
      apiMode: "official",
      retryable: false,
      code: "finik_official_status_not_available",
    };
  }

  const finalReason =
    attempts.length === 0
      ? "no_paths_configured"
      : attempts.some((a) => a.reason === "network_error")
        ? "network_error"
        : attempts.every((a) => a.reason === "signing_failed")
          ? "signing_failed"
          : attempts.every((a) => a.reason === "parse_failed")
            ? "parse_failed"
            : attempts.some((a) => a.httpStatus === 404)
              ? "http_404"
              : attempts.some((a) => a.httpStatus === 403)
                ? "http_403"
                : "all_attempts_exhausted";

  logFinikStatusAdapterFailed({
    apiMode: "official",
    paymentId: pid,
    attempts,
    finalReason,
    ...(queryContext?.businessId != null
      ? { businessId: queryContext.businessId }
      : {}),
    ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
  });

  logFinikStatusResult({
    apiMode: "official",
    ok: false,
    paymentId: pid,
    ...(queryContext?.businessId != null
      ? { businessId: queryContext.businessId }
      : {}),
    ...(queryContext?.orderId != null ? { orderId: queryContext.orderId } : {}),
  });

  return {
    ok: false,
    error: "Finik Official API: не удалось получить статус платежа",
    apiMode: "official",
    retryable: lastHttpStatus != null && lastHttpStatus >= 500,
  };
}
