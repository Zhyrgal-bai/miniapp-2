import {
  getLegacyFinikApiBaseUrl,
  getLegacyFinikCreatePaymentPath,
} from "./finikCreateConfig.js";
import {
  logFinikCreateHttpError,
} from "./finikCreateLogging.js";
import { normalizeLegacyFinikCreateResponse } from "./finikCreateResponseNormalizer.js";
import type {
  FinikCreateContext,
  FinikCreatePort,
  FinikCreateResult,
} from "./finikCreateTypes.js";

function legacyAuthHeaders(ctx: FinikCreateContext): Record<string, string> | null {
  if (ctx.tenant.kind === "business") {
    const key = ctx.tenant.finikApiKey?.trim() ?? "";
    const secret = ctx.tenant.finikSecret?.trim() ?? "";
    if (key === "" || secret === "") return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Api-Secret": secret,
    };
  }
  const key = ctx.tenant.apiKey.trim();
  const secret = ctx.tenant.secret.trim();
  if (key === "" || secret === "") return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "X-Api-Secret": secret,
  };
}

/**
 * Legacy HTTP create (`Bearer` + `X-Api-Secret`, `POST /payments`).
 * Дублирует контракт `finikMerchant.ts` — production checkout по-прежнему вызывает finikMerchant напрямую.
 */
export const legacyCreateAdapter: FinikCreatePort = {
  apiMode: "legacy",

  async createPaymentSession(ctx: FinikCreateContext): Promise<FinikCreateResult> {
    const headers = legacyAuthHeaders(ctx);
    if (headers == null) {
      return {
        ok: false,
        error: "Finik legacy HTTP: не заданы API Key и Secret",
        code: "finik_legacy_credentials_missing",
        apiMode: "legacy",
      };
    }

    const url = `${getLegacyFinikApiBaseUrl()}${getLegacyFinikCreatePaymentPath()}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: ctx.amount,
          currency: ctx.currency,
          order_id: ctx.orderId,
          external_id: ctx.externalId,
          callback_url: ctx.callbackUrl,
          return_url: ctx.returnUrl,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        logFinikCreateHttpError({
          apiMode: "legacy",
          flow: ctx.flow,
          httpStatus: res.status,
          ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
        });
        return {
          ok: false,
          error: "Finik API отклонил запрос (проверьте ключи и URL API)",
          code: "finik_legacy_http_rejected",
          retryable: res.status >= 500,
          apiMode: "legacy",
        };
      }

      const normalized = normalizeLegacyFinikCreateResponse(json);
      if (!normalized.ok) {
        return {
          ok: false,
          error: normalized.error,
          code: "finik_legacy_unexpected_body",
          apiMode: "legacy",
        };
      }

      return {
        ok: true,
        paymentId: normalized.paymentId,
        paymentUrl: normalized.paymentUrl,
        apiMode: "legacy",
      };
    } catch {
      return {
        ok: false,
        error: "Ошибка сети при обращении к Finik",
        code: "finik_legacy_network",
        retryable: true,
        apiMode: "legacy",
      };
    }
  },
};
