import { buildStorefrontOrderFinikCreateContext } from "./buildStorefrontOrderFinikCreateContext.js";
import type {
  StorefrontFinikBusiness,
  StorefrontFinikOrderInput,
} from "./buildStorefrontOrderFinikCreateContext.js";
import { createFinikPaymentSession } from "./finikCreateRouter.js";

export type StorefrontFinikCheckoutSessionResult =
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string };

/**
 * Storefront checkout: create payment через router (mock / official / legacy).
 */
export async function createStorefrontFinikCheckoutSession(
  business: StorefrontFinikBusiness,
  input: StorefrontFinikOrderInput,
): Promise<StorefrontFinikCheckoutSessionResult> {
  const built = buildStorefrontOrderFinikCreateContext(business, input);
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const result = await createFinikPaymentSession(built.ctx);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    paymentId: result.paymentId,
    paymentUrl: result.paymentUrl,
  };
}
