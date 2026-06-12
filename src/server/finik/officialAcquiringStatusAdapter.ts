import {
  getOfficialAcquiringBaseUrl,
  listOfficialAcquiringStatusPaths,
} from "./finikCreateConfig.js";
import { getFinikApiKey } from "./finikKeys.js";
import {
  logFinikStatusAttempt,
  logFinikStatusHttpError,
  logFinikStatusResult,
} from "./finikCreateLogging.js";
import {
  isFinikPlatformManagedMerchantsEnabled,
  isMerchantFinikPlatformManaged,
} from "./resolveFinikTenantCredentials.js";
import { signFinikOfficialGetRequest } from "./finikRsaSigning.js";
import { normalizeFinikPaymentStatusResponse } from "./finikStatusResponseNormalizer.js";
import type {
  FinikPaymentStatusResult,
  FinikStatusBusinessCredentials,
} from "./finikStatusTypes.js";

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

async function fetchOfficialStatusAtPath(input: {
  path: string;
  apiKey: string;
  host: string;
  paymentId: string;
  businessId?: number;
  orderId?: number;
}): Promise<
  | { ok: true; status: string; amount: number | null; path: string }
  | { ok: false; httpStatus?: number; path: string }
> {
  const url = `${getOfficialAcquiringBaseUrl()}${input.path}`;
  logFinikStatusAttempt({
    apiMode: "official",
    paymentId: input.paymentId,
    path: input.path,
    ...(input.businessId != null ? { businessId: input.businessId } : {}),
    ...(input.orderId != null ? { orderId: input.orderId } : {}),
  });

  let signature: string;
  let timestamp: string;
  try {
    ({ signature, timestamp } = await signFinikOfficialGetRequest({
      host: input.host,
      path: input.path,
      apiKey: input.apiKey,
    }));
  } catch {
    return { ok: false, path: input.path };
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": input.apiKey,
      "x-api-timestamp": timestamp,
      signature,
    },
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    logFinikStatusHttpError({
      apiMode: "official",
      httpStatus: res.status,
      paymentId: input.paymentId,
      path: input.path,
      ...(input.businessId != null ? { businessId: input.businessId } : {}),
      ...(input.orderId != null ? { orderId: input.orderId } : {}),
    });
    return { ok: false, httpStatus: res.status, path: input.path };
  }

  const parsed = normalizeFinikPaymentStatusResponse(json);
  if (parsed.status === "") {
    return { ok: false, httpStatus: res.status, path: input.path };
  }

  return {
    ok: true,
    status: parsed.status,
    amount: parsed.amount,
    path: input.path,
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
      if (out.httpStatus != null) {
        lastHttpStatus = out.httpStatus;
      }
    }
  } catch {
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
