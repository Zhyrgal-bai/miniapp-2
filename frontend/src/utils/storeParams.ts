import { getWebAppUserId } from "./telegramUserId";

const STORAGE_KEY = "miniapp-active-shop";
const SLUG_SESSION_KEY = "miniapp-store-slug";

function parseDigits(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return /^\d+$/.test(t) ? t : undefined;
}

function isLikelyMiniAppEnv(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp);
}

function startParamFromSignedInitData(): string | undefined {
  const raw = window.Telegram?.WebApp?.initData?.trim() ?? "";
  if (raw === "") return undefined;
  try {
    const p = new URLSearchParams(raw);
    const sp = p.get("start_param")?.trim();
    return sp || undefined;
  } catch {
    return undefined;
  }
}

function decodeMaybe(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeStoreSlug(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const decoded = decodeMaybe(String(raw)).trim().toLowerCase();
  if (decoded === "") return undefined;
  if (decoded.includes("/")) return undefined;
  if (decoded.length < 2 || decoded.length > 80) return undefined;
  return decoded;
}

function parseStartParamTenant(raw: string | undefined): {
  shopIdString?: string;
  storefrontSlug?: string;
} {
  const source = raw?.trim();
  if (!source) return {};
  const s = decodeMaybe(source).trim();

  // Legacy / current numeric launch forms.
  const mId = /^shop[_-]?(\d+)$/i.exec(s);
  if (mId) return { shopIdString: mId[1] };
  const directId = parseDigits(s);
  if (directId) return { shopIdString: directId };

  // Prefix-based slug launch forms: slug_x, store_x, s_x, shop_x.
  const mSlug = /^(?:slug|store|s|shop)[_:-](.+)$/i.exec(s);
  if (mSlug) {
    const slug = normalizeStoreSlug(mSlug[1]);
    if (slug) return { storefrontSlug: slug };
  }

  // Plain startapp payload with slug.
  const plainSlug = normalizeStoreSlug(s);
  if (plainSlug && /[a-zа-я0-9_-]/i.test(plainSlug)) {
    return { storefrontSlug: plainSlug };
  }

  return {};
}

/** `/store/my-shop` or `/s/my-shop` -> `my-shop` (decoded segment). */
export function parseStoreSlugFromPath(pathname: string): string | undefined {
  const p = String(pathname ?? "").replace(/\/+$/, "");
  const m = /^\/(?:store|s)\/([^/]+)$/i.exec(p);
  if (!m) return undefined;
  const slug = normalizeStoreSlug(m[1]);
  return slug;
}

function storeSlugFromQuery(pathname?: string, rawSearch?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = pathname ?? window.location.pathname ?? "";
  if (parseStoreSlugFromPath(path)) return undefined;
  const baseSearch = rawSearch ?? window.location.search;
  const sp = new URLSearchParams(baseSearch);
  const direct = normalizeStoreSlug(
    sp.get("slug") ?? sp.get("store") ?? sp.get("storeSlug"),
  );
  if (direct) return direct;
  const fromTgQuery = parseStartParamTenant(sp.get("tgWebAppStartParam") ?? undefined).storefrontSlug;
  if (fromTgQuery) return fromTgQuery;
  const fromInit = parseStartParamTenant(startParamFromSignedInitData()).storefrontSlug;
  if (fromInit) return fromInit;
  const fromSession = normalizeStoreSlug(sessionStorage.getItem(SLUG_SESSION_KEY));
  if (fromSession && isLikelyMiniAppEnv()) return fromSession;
  return undefined;
}

export function readStoreSlugString(pathname?: string, rawSearch?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = pathname ?? window.location.pathname ?? "";
  const pathSlug = parseStoreSlugFromPath(path);
  if (pathSlug) return pathSlug;
  return storeSlugFromQuery(path, rawSearch);
}

function readLegacyShopIdFromQueryOrTelegram(pathname?: string, rawSearch?: string): string | undefined {
  if (typeof window === "undefined") return undefined;

  const path = pathname ?? window.location.pathname ?? "";
  const slug = parseStoreSlugFromPath(path) ?? storeSlugFromQuery(path, rawSearch);
  if (slug) {
    const savedSlug = normalizeStoreSlug(sessionStorage.getItem(SLUG_SESSION_KEY));
    const id = parseDigits(sessionStorage.getItem(STORAGE_KEY));
    if (savedSlug === slug && id) return id;
    return undefined;
  }

  const baseSearch = rawSearch ?? window.location.search;
  const sp = new URLSearchParams(baseSearch);
  const urlShop =
    parseDigits(sp.get("shop")) ?? parseDigits(sp.get("businessId"));
  const tgFromQuery = parseStartParamTenant(sp.get("tgWebAppStartParam") ?? undefined);
  const tgInit = parseStartParamTenant(startParamFromSignedInitData());

  const id = urlShop ?? tgFromQuery.shopIdString ?? tgInit.shopIdString;

  if (id) {
    sessionStorage.setItem(STORAGE_KEY, id);
    if (tgFromQuery.storefrontSlug) sessionStorage.setItem(SLUG_SESSION_KEY, tgFromQuery.storefrontSlug);
    else if (tgInit.storefrontSlug) sessionStorage.setItem(SLUG_SESSION_KEY, tgInit.storefrontSlug);
    return id;
  }

  const mem = parseDigits(sessionStorage.getItem(STORAGE_KEY));
  if (mem && isLikelyMiniAppEnv()) return mem;

  return undefined;
}

/**
 * Активный tenant: приоритет slug-маршрут + сессия, затем `?shop=` / Telegram / session в Mini App.
 */
export function readShopIdString(pathname?: string, rawSearch?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return readLegacyShopIdFromQueryOrTelegram(pathname, rawSearch);
}

export function hasTenantLaunchHint(pathname?: string, rawSearch?: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(readStoreSlugString(pathname, rawSearch) || readShopIdString(pathname, rawSearch));
}

export function getActiveShopId(): string | undefined {
  return readShopIdString();
}

export function getBusinessIdNumber(pathname?: string): number | null {
  const s = readShopIdString(pathname);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Параметры публичного каталога и витрины: `shop`, `businessId` (алиас для API), опционально `userId`. */
export function buildCatalogRequestParams(pathname?: string): Record<string, string> {
  const shop = readShopIdString(pathname);
  const uid = getWebAppUserId();
  const p: Record<string, string> = {};
  if (shop) {
    p.shop = shop;
    p.businessId = shop;
  }
  if (Number.isFinite(uid) && uid > 0) p.userId = String(uid);
  return p;
}

/**
 * Объединяет текущий query с каноническим tenant.
 * Предпочитает `/store/:slug` если известен `storefrontSlug`, иначе legacy `?shop=`.
 */
export function mergeTenantIntoLocation(opts: {
  pathname: string;
  rawSearch: string;
  shopIdString: string;
  storefrontSlug?: string | null;
}): { pathname: string; search: string } {
  const slug =
    typeof opts.storefrontSlug === "string" && opts.storefrontSlug.trim() !== ""
      ? opts.storefrontSlug.trim()
      : null;
  const trimmed = opts.rawSearch.trim();
  const withoutQ = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
  const p = new URLSearchParams(withoutQ);
  p.delete("shop");
  p.delete("businessId");
  const qs = p.toString();

  if (slug) {
    const enc = encodeURIComponent(slug);
    const keepPath = opts.pathname === "/faq" || opts.pathname === "/about";
    const pathname = keepPath ? opts.pathname : `/store/${enc}`;
    return {
      pathname,
      search: qs ? `?${qs}` : "",
    };
  }

  p.set("shop", opts.shopIdString);
  const out = p.toString();
  return {
    pathname: opts.pathname === "/faq" || opts.pathname === "/about" ? opts.pathname : "/",
    search: out ? `?${out}` : `?shop=${encodeURIComponent(opts.shopIdString)}`,
  };
}

/** @deprecated Используйте mergeTenantIntoLocation */
export function mergeTenantShopIntoSearch(rawSearch: string, shopId: string): string {
  const p = new URLSearchParams(rawSearch.trim().replace(/^\?/, ""));
  p.set("shop", shopId);
  const out = p.toString();
  return out ? `?${out}` : `?shop=${encodeURIComponent(shopId)}`;
}

export function rememberResolvedStoreSlug(slug: string, businessId: number): void {
  if (typeof window === "undefined") return;
  const normalizedSlug = normalizeStoreSlug(slug) ?? slug.trim().toLowerCase();
  sessionStorage.setItem(SLUG_SESSION_KEY, normalizedSlug);
  sessionStorage.setItem(STORAGE_KEY, String(businessId));
}
