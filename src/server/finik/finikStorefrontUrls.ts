/** URL витрины для RedirectUrl после оплаты Finik (не webhook). */

function storefrontBaseUrl(): string {
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
 * Возврат покупателя в Mini App после Finik (`view=my-orders` для poll UI).
 */
export function buildStorefrontFinikReturnUrl(
  businessId: number,
  slug?: string | null,
): string | null {
  const base = storefrontBaseUrl();
  if (base === "") return null;

  const normalizedSlug = slug?.trim().toLowerCase() ?? "";
  if (normalizedSlug !== "") {
    return `${base}/s/${encodeURIComponent(normalizedSlug)}?view=my-orders`;
  }
  return `${base}/?shop=${encodeURIComponent(String(businessId))}&view=my-orders`;
}
