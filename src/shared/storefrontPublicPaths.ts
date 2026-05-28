/**
 * Storefront table booking / QR — public customer APIs (no tenant businessMiddleware).
 * Must stay in sync with frontend `isPublicStorefrontPath` in services/api.ts.
 */
export function isPublicStorefrontBookingPath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  if (/^\/api\/storefront\/\d+\/dining-tables/i.test(p)) return true;
  if (/^\/api\/storefront\/\d+\/table-reservations/i.test(p)) return true;
  if (/^\/api\/storefront\/table-qr\//i.test(p)) return true;
  return false;
}

/** Storefront booking POST/QR: verified initData required (sets platformTelegramId). */
export function storefrontBookingRequiresVerifiedTelegram(
  method: string,
  pathname: string,
): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  const m = method.toUpperCase();
  if (m === "POST" && /^\/api\/storefront\/\d+\/table-reservations$/i.test(p)) {
    return true;
  }
  if (p.startsWith("/api/storefront/table-qr/")) return true;
  return false;
}
