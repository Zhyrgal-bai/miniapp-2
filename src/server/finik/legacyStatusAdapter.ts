import {
  getLegacyFinikApiBaseUrl,
} from "./finikCreateConfig.js";
import { normalizeFinikPaymentStatusResponse } from "./finikStatusResponseNormalizer.js";
import type {
  FinikPaymentStatusResult,
  FinikStatusBusinessCredentials,
} from "./finikStatusTypes.js";

function legacyGetPaymentPath(paymentId: string): string {
  const template = (
    process.env.FINIK_API_GET_PAYMENT_PATH || "/payments/{id}"
  ).trim();
  const path = template.replace("{id}", encodeURIComponent(paymentId));
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Legacy HTTP GET статуса (`Bearer` + `X-Api-Secret`, `api.finik.kg`).
 */
export async function fetchLegacyFinikPaymentStatus(
  business: FinikStatusBusinessCredentials,
  paymentId: string,
): Promise<FinikPaymentStatusResult> {
  const key = business.finikApiKey?.trim() ?? "";
  const secret = business.finikSecret?.trim() ?? "";
  if (key === "" || secret === "") {
    return {
      ok: false,
      error: "Finik legacy HTTP: не заданы API Key и Secret",
      apiMode: "legacy",
    };
  }

  const url = `${getLegacyFinikApiBaseUrl()}${legacyGetPaymentPath(paymentId)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Api-Secret": secret,
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: "Finik API: не удалось получить статус платежа",
        apiMode: "legacy",
        retryable: res.status >= 500,
      };
    }
    const parsed = normalizeFinikPaymentStatusResponse(json);
    return {
      ok: true,
      status: parsed.status,
      amount: parsed.amount,
      apiMode: "legacy",
    };
  } catch {
    return {
      ok: false,
      error: "Ошибка сети при запросе статуса Finik",
      apiMode: "legacy",
      retryable: true,
    };
  }
}
