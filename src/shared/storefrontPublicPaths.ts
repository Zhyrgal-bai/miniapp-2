/**
 * Storefront table booking / QR — public customer APIs (no tenant businessMiddleware).
 * Must stay in sync with frontend `isPublicStorefrontPath` in services/api.ts.
 *
 * Inside `app.use("/api", businessMiddleware)` Express sets `req.path` without the `/api`
 * prefix (e.g. `/storefront/1/dining-tables`). Full paths from axios still include `/api`.
 */
export function normalizeStorefrontApiPath(pathname: string): string {
  const p = (pathname.split("?")[0] ?? pathname).trim();
  if (p.startsWith("/api/")) return p.slice(4);
  if (p === "/api") return "/";
  return p;
}

export function isPublicStorefrontBookingPath(pathname: string): boolean {
  const p = normalizeStorefrontApiPath(pathname);
  if (/^\/storefront\/\d+\/dining-tables/i.test(p)) return true;
  if (/^\/storefront\/\d+\/table-reservations/i.test(p)) return true;
  if (/^\/storefront\/table-qr\//i.test(p)) return true;
  return false;
}

/** Storefront booking POST/QR: verified initData required (sets platformTelegramId). */
export function storefrontBookingRequiresVerifiedTelegram(
  method: string,
  pathname: string,
): boolean {
  const p = normalizeStorefrontApiPath(pathname);
  const m = method.toUpperCase();
  if (m === "POST" && /^\/storefront\/\d+\/table-reservations$/i.test(p)) {
    return true;
  }
  if (p.startsWith("/storefront/table-qr/")) return true;
  return false;
}
