import { publicApiOrigin } from "../finikMerchant.js";

function subscriptionReturnBaseUrl(): string {
  const api = publicApiOrigin();
  if (api !== "") return api;
  return (
    process.env.FRONTEND_URL ||
    process.env.FRONT_URL ||
    process.env.PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

/**
 * Browser RedirectUrl после оплаты подписки Finik (не webhook).
 * @see buildStorefrontFinikReturnUrl — аналог для merchant subscription page.
 */
export function buildPlatformSubscriptionFinikReturnUrl(): string | null {
  const base = subscriptionReturnBaseUrl();
  if (base === "") return null;
  return `${base}/merchant/subscription?finik=return`;
}
