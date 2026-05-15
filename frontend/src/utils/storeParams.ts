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

/** `startapp=shop_12` или `startapp=12` в Mini App. */
function shopFromTelegramStartParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  const m = /^shop[_-]?(\d+)$/i.exec(s);
  if (m) return m[1];
  return parseDigits(s);
}

/** `/store/my-shop` → `my-shop` (decoded segment). */
export function parseStoreSlugFromPath(pathname: string): string | undefined {
  const p = String(pathname ?? "").replace(/\/+$/, "");
  const m = /^\/store\/([^/]+)$/i.exec(p);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]).trim() || undefined;
  } catch {
    return m[1].trim() || undefined;
  }
}

function readLegacyShopIdFromQueryOrTelegram(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const sp = new URLSearchParams(window.location.search);
  const urlShop =
    parseDigits(sp.get("shop")) ?? parseDigits(sp.get("businessId"));
  const tgFromQuery = shopFromTelegramStartParam(
    sp.get("tgWebAppStartParam") ?? undefined,
  );
  const tgInit = shopFromTelegramStartParam(startParamFromSignedInitData());

  const id = urlShop ?? tgFromQuery ?? tgInit;

  if (id) {
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  }

  const mem = parseDigits(sessionStorage.getItem(STORAGE_KEY));
  if (mem && isLikelyMiniAppEnv()) return mem;

  return undefined;
}

/**
 * Активный tenant: приоритет slug-маршрут + сессия, затем `?shop=` / Telegram / session в Mini App.
 */
export function readShopIdString(pathname?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = pathname ?? window.location.pathname ?? "";
  const slug = parseStoreSlugFromPath(path);
  if (slug) {
    const savedSlug = sessionStorage.getItem(SLUG_SESSION_KEY);
    const id = parseDigits(sessionStorage.getItem(STORAGE_KEY));
    if (savedSlug === slug && id) return id;
    return undefined;
  }
  return readLegacyShopIdFromQueryOrTelegram();
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
  sessionStorage.setItem(SLUG_SESSION_KEY, slug);
  sessionStorage.setItem(STORAGE_KEY, String(businessId));
}
