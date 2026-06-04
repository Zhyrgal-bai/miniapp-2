import {
  getOfficialAcquiringBaseUrl,
  getOfficialAcquiringStatusPath,
} from "./finikCreateConfig.js";
import { getFinikApiKey } from "./finikKeys.js";
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
  const k = business.finikApiKey?.trim() ?? "";
  if (k !== "") return k;
  return getFinikApiKey();
}

/**
 * Official Finik Acquiring GET payment status (RSA-SHA256).
 * @see https://telegra.ph/Finikkg-09-10 — webhook documented; GET inferred as GET /v1/payment/{PaymentId}
 */
export async function fetchOfficialFinikPaymentStatus(
  business: FinikStatusBusinessCredentials,
  paymentId: string,
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

  const path = getOfficialAcquiringStatusPath(pid);
  const host = officialAcquiringHost();
  const url = `${getOfficialAcquiringBaseUrl()}${path}`;

  let signature: string;
  let timestamp: string;
  try {
    ({ signature, timestamp } = await signFinikOfficialGetRequest({
      host,
      path,
      apiKey,
    }));
  } catch {
    return {
      ok: false,
      error:
        "Finik Official: не настроен приватный ключ (FINIK_RSA_PRIVATE_KEY или FINIK_PRIVATE_KEY)",
      apiMode: "official",
    };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-api-timestamp": timestamp,
        signature,
      },
    });

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      return {
        ok: false,
        error: "Finik Official API: не удалось получить статус платежа",
        apiMode: "official",
        retryable: res.status >= 500,
      };
    }

    const parsed = normalizeFinikPaymentStatusResponse(json);
    if (parsed.status === "") {
      return {
        ok: false,
        error: "Finik Official: в ответе нет статуса платежа",
        apiMode: "official",
      };
    }

    return {
      ok: true,
      status: parsed.status,
      amount: parsed.amount,
      apiMode: "official",
    };
  } catch {
    return {
      ok: false,
      error: "Ошибка сети при запросе статуса Finik Official API",
      apiMode: "official",
      retryable: true,
    };
  }
}
