import { randomUUID } from "node:crypto";
import type { FinikOfficialRequestBody } from "./finikRsaSigning.js";
import {
  getOfficialAcquiringBaseUrl,
  getOfficialAcquiringCreatePath,
} from "./finikCreateConfig.js";
import { getFinikAccountId, getFinikApiKey } from "./finikKeys.js";
import { logFinikCreateHttpError } from "./finikCreateLogging.js";
import { normalizeOfficialFinikCreateResponse } from "./finikCreateResponseNormalizer.js";
import { signFinikOfficialRequest } from "./finikRsaSigning.js";
import type {
  FinikCreateContext,
  FinikCreatePort,
  FinikCreateResult,
} from "./finikCreateTypes.js";

const OFFICIAL_SUCCESS_STATUSES = new Set([201, 302, 301, 303, 307, 308]);

function officialAcquiringHost(): string {
  return new URL(getOfficialAcquiringBaseUrl()).host;
}

function resolveOfficialApiKey(ctx: FinikCreateContext): string {
  if (ctx.tenant.kind === "business") {
    const k = ctx.tenant.finikApiKey?.trim() ?? "";
    if (k !== "") return k;
  }
  return getFinikApiKey();
}

function resolveOfficialAccountId(ctx: FinikCreateContext): string {
  if (ctx.tenant.kind === "business") {
    const id = ctx.tenant.finikAccountId?.trim() ?? "";
    if (id !== "") return id;
  }
  return getFinikAccountId();
}

function resolveOfficialDisplayName(ctx: FinikCreateContext): string {
  const fromEnv = process.env.FINIK_OFFICIAL_NAME_EN?.trim() ?? "";
  if (fromEnv !== "") return fromEnv;
  if (ctx.tenant.kind === "business") {
    return `merchant-${ctx.tenant.businessId}`;
  }
  return "platform";
}

function resolveMerchantCategoryCode(): string {
  return (
    process.env.FINIK_OFFICIAL_MERCHANT_CATEGORY_CODE?.trim() || "0742"
  );
}

function isPlatformSubscriptionFlow(ctx: FinikCreateContext): boolean {
  return (
    ctx.flow === "platform_subscription" || ctx.flow === "saas_subscription"
  );
}

function buildOfficialPaymentBody(
  ctx: FinikCreateContext,
  accountId: string,
): FinikOfficialRequestBody {
  const data: Record<string, unknown> = {
    accountId,
    merchantCategoryCode: resolveMerchantCategoryCode(),
    name_en: resolveOfficialDisplayName(ctx),
    webhookUrl: ctx.callbackUrl,
  };
  if (isPlatformSubscriptionFlow(ctx) && ctx.externalId.trim() !== "") {
    data.externalId = ctx.externalId.trim();
  }

  return {
    Amount: ctx.amount,
    CardType: "FINIK_QR",
    PaymentId: randomUUID(),
    RedirectUrl: ctx.returnUrl,
    Data: data,
  };
}

/**
 * Official Finik Acquiring API (`POST /v1/payment`, RSA-SHA256).
 */
export const officialAcquiringCreateAdapter: FinikCreatePort = {
  apiMode: "official",

  async createPaymentSession(
    ctx: FinikCreateContext,
  ): Promise<FinikCreateResult> {
    const apiKey = resolveOfficialApiKey(ctx);
    const accountId = resolveOfficialAccountId(ctx);

    if (apiKey === "" || accountId === "") {
      return {
        ok: false,
        error:
          "Finik Official: не заданы API Key и Account ID (магазин или FINIK_API_KEY / FINIK_ACCOUNT_ID)",
        code: "finik_official_credentials_missing",
        apiMode: "official",
      };
    }

    const path = getOfficialAcquiringCreatePath();
    const host = officialAcquiringHost();
    const url = `${getOfficialAcquiringBaseUrl()}${path}`;
    const body = buildOfficialPaymentBody(ctx, accountId);

    let signature: string;
    let timestamp: string;
    let bodyJson: string;
    try {
      ({ signature, timestamp, bodyJson } = await signFinikOfficialRequest({
        host,
        path,
        apiKey,
        body,
      }));
    } catch {
      return {
        ok: false,
        error:
          "Finik Official: не настроен приватный ключ (FINIK_RSA_PRIVATE_KEY или FINIK_PRIVATE_KEY)",
        code: "finik_official_signing_missing",
        apiMode: "official",
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "x-api-timestamp": timestamp,
          signature,
        },
        body: bodyJson,
        redirect: "manual",
      });

      if (!OFFICIAL_SUCCESS_STATUSES.has(res.status)) {
        logFinikCreateHttpError({
          apiMode: "official",
          flow: ctx.flow,
          httpStatus: res.status,
          ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
        });
        return {
          ok: false,
          error: "Finik Official API отклонил запрос (проверьте ключи, подпись и URL)",
          code: "finik_official_http_rejected",
          retryable: res.status >= 500,
          apiMode: "official",
        };
      }

      const location = res.headers.get("location")?.trim() ?? "";
      if (location !== "") {
        const paymentId =
          typeof body.PaymentId === "string" ? body.PaymentId : "";
        if (paymentId === "") {
          return {
            ok: false,
            error: "Finik Official: redirect без payment id",
            code: "finik_official_unexpected_body",
            apiMode: "official",
          };
        }
        return {
          ok: true,
          paymentId,
          paymentUrl: location,
          apiMode: "official",
        };
      }

      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const normalized = normalizeOfficialFinikCreateResponse(json);
      if (!normalized.ok) {
        return {
          ok: false,
          error: normalized.error,
          code: "finik_official_unexpected_body",
          apiMode: "official",
        };
      }

      return {
        ok: true,
        paymentId: normalized.paymentId,
        paymentUrl: normalized.paymentUrl,
        apiMode: "official",
      };
    } catch {
      return {
        ok: false,
        error: "Ошибка сети при обращении к Finik Official API",
        code: "finik_official_network",
        retryable: true,
        apiMode: "official",
      };
    }
  },
};
