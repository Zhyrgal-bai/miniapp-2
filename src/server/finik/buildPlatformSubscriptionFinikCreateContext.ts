import {
  getPlatformFinikApiKey,
  platformFinikUseMockForCreate,
} from "../../shared/platformFinik.js";
import { publicApiOrigin } from "../finikMerchant.js";
import type { FinikCreateContext } from "./finikCreateTypes.js";
import { buildPlatformSubscriptionFinikReturnUrl } from "./finikPlatformSubscriptionUrls.js";

export type BuildPlatformSubscriptionFinikContextInput = {
  subscriptionPaymentRowId: number;
  amountSom: number;
  currency?: string;
};

export type BuildPlatformSubscriptionFinikContextResult =
  | { ok: true; ctx: FinikCreateContext }
  | { ok: false; error: string };

/** Correlation id для Finik webhook fallback: `saas_sub:{subscriptionFinikPayment.id}`. */
export function platformSubscriptionFinikExternalId(
  subscriptionPaymentRowId: number,
): string {
  return `saas_sub:${subscriptionPaymentRowId}`;
}

export function buildPlatformSubscriptionFinikCreateContext(
  input: BuildPlatformSubscriptionFinikContextInput,
): BuildPlatformSubscriptionFinikContextResult {
  const useMock = platformFinikUseMockForCreate();
  const externalId = platformSubscriptionFinikExternalId(
    input.subscriptionPaymentRowId,
  );

  let callbackUrl: string;
  let returnUrl: string | null;
  if (!useMock) {
    const origin = publicApiOrigin();
    if (!origin) {
      return {
        ok: false,
        error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
      };
    }
    callbackUrl = `${origin}/api/platform/subscription-finik-webhook`;
    returnUrl = buildPlatformSubscriptionFinikReturnUrl();
    if (returnUrl == null) {
      returnUrl = `${origin}/merchant/subscription?finik=return`;
    }
  } else {
    callbackUrl = "https://pay.finik.kg/mock-platform-subscription-webhook";
    returnUrl =
      buildPlatformSubscriptionFinikReturnUrl() ??
      "https://pay.finik.kg/merchant/subscription?finik=return";
  }

  const ctx: FinikCreateContext = {
    flow: "platform_subscription",
    tenant: {
      kind: "platform",
      apiKey: getPlatformFinikApiKey(),
    },
    amount: input.amountSom,
    currency: input.currency ?? "KGS",
    orderId: externalId,
    externalId,
    callbackUrl,
    returnUrl,
  };

  return { ok: true, ctx };
}
