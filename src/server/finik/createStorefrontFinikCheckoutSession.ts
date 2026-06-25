import { prisma } from "../db.js";
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
 * Storefront checkout: single payment to the merchant Finik account.
 * `amount` is order.total (goods + merchant-owned delivery fee when applicable).
 * Merchant-owned delivery is not split to ARCHA; provider deliveries may use
 * separate marketplace flows in the future.
 */
export async function createStorefrontFinikCheckoutSession(
  business: StorefrontFinikBusiness,
  input: StorefrontFinikOrderInput,
): Promise<StorefrontFinikCheckoutSessionResult> {
  const slugRow = await prisma.business.findUnique({
    where: { id: business.id },
    select: { slug: true },
  });
  const built = buildStorefrontOrderFinikCreateContext(business, input, {
    slug: slugRow?.slug ?? null,
  });
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
