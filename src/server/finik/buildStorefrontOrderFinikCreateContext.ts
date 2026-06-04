import {
  buildFinikWebhookUrl,
  finikUseMockForBusiness,
} from "../../shared/finikReady.js";
import { publicApiOrigin } from "../finikMerchant.js";
import type { FinikCreateContext } from "./finikCreateTypes.js";

export type StorefrontFinikBusiness = {
  id: number;
  finikApiKey: string | null;
  finikAccountId: string | null;
  finikSecret: string | null;
};

export type StorefrontFinikOrderInput = {
  orderId: number;
  amount: number;
  currency?: string;
  correlationId?: string;
};

export type BuildStorefrontFinikContextResult =
  | { ok: true; ctx: FinikCreateContext }
  | { ok: false; error: string };

export function buildStorefrontOrderFinikCreateContext(
  business: StorefrontFinikBusiness,
  input: StorefrontFinikOrderInput,
): BuildStorefrontFinikContextResult {
  const useMock = finikUseMockForBusiness(business);
  let callbackUrl: string;

  if (!useMock) {
    const origin = publicApiOrigin();
    if (!origin) {
      return {
        ok: false,
        error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
      };
    }
    callbackUrl =
      buildFinikWebhookUrl(origin, business.id) ??
      `${origin}/finik/webhook/${business.id}`;
  } else {
    callbackUrl = `https://pay.finik.kg/mock-webhook/${business.id}`;
  }

  const ctx: FinikCreateContext = {
    flow: "storefront_order",
    tenant: {
      kind: "business",
      businessId: business.id,
      finikApiKey: business.finikApiKey,
      finikAccountId: business.finikAccountId,
      finikSecret: business.finikSecret,
    },
    amount: input.amount,
    currency: input.currency ?? "KGS",
    orderId: String(input.orderId),
    externalId: `${business.id}:${input.orderId}`,
    callbackUrl,
    returnUrl: callbackUrl,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  };

  return { ok: true, ctx };
}
