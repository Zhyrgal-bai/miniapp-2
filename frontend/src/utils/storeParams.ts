import { getWebAppUserId } from "./telegramUserId";

const STORAGE_KEY = "miniapp-active-shop";

function parseDigits(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return /^\d+$/.test(t) ? t : undefined;
}

function isLikelyMiniAppEnv(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp);
}

/** `startapp=shop_12` или `startapp=12` в Mini App. */
function shopFromTelegramStartParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  const m = /^shop[_-]?(\d+)$/i.exec(s);
  if (m) return m[1];
  return parseDigits(s);
}

/**
 * Читает магазин из `?shop=` / `?businessId=`, параметров Telegram Mini App или `start_param`;
 * сохраняет в sessionStorage только после явного источника (URL/Telegram).
 * В обычном браузере без этих источников sessionStorage игнорируется — без «общего» маркетплейса.
 */
export function readShopIdString(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const sp = new URLSearchParams(window.location.search);
  const urlShop =
    parseDigits(sp.get("shop")) ?? parseDigits(sp.get("businessId"));
  const tgFromQuery = shopFromTelegramStartParam(
    sp.get("tgWebAppStartParam") ?? undefined,
  );
  const tgInit = shopFromTelegramStartParam(
    window.Telegram?.WebApp?.initDataUnsafe?.start_param,
  );

  const id = urlShop ?? tgFromQuery ?? tgInit;

  if (id) {
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  }

  const mem = parseDigits(sessionStorage.getItem(STORAGE_KEY));
  if (mem && isLikelyMiniAppEnv()) return mem;

  return undefined;
}

export function getActiveShopId(): string | undefined {
  return readShopIdString();
}

export function getBusinessIdNumber(): number | null {
  const s = readShopIdString();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Параметры публичного каталога и витрины: `shop`, `businessId` (алиас для API), опционально `userId`. */
export function buildCatalogRequestParams(): Record<string, string> {
  const shop = readShopIdString();
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
 * Объединяет текущий query с каноническим `shop=` (для навигации без потери tenant).
 */
export function mergeTenantShopIntoSearch(rawSearch: string, shopId: string): string {
  const trimmed = rawSearch.trim();
  const withoutQ =
    trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
  const p = new URLSearchParams(withoutQ);
  p.set("shop", shopId);
  const out = p.toString();
  return out ? `?${out}` : `?shop=${encodeURIComponent(shopId)}`;
}
