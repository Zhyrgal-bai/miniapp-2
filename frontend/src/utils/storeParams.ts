import { getWebAppUserId } from "./telegramUserId";

const STORAGE_KEY = "miniapp-active-shop";

function parseDigits(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return /^\d+$/.test(t) ? t : undefined;
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
 * Читает `?shop=`, `?businessId=`, `tgWebAppStartParam`, `Telegram.WebApp.initDataUnsafe.start_param`;
 * при успехе пишет в sessionStorage для навигации без query.
 */
export function readShopIdString(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const sp = new URLSearchParams(window.location.search);
  let id =
    parseDigits(sp.get("shop")) ??
    parseDigits(sp.get("businessId")) ??
    shopFromTelegramStartParam(sp.get("tgWebAppStartParam") ?? undefined);

  if (!id) {
    id = shopFromTelegramStartParam(
      window.Telegram?.WebApp?.initDataUnsafe?.start_param,
    );
  }

  if (id) {
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  }

  const mem = sessionStorage.getItem(STORAGE_KEY);
  return parseDigits(mem ?? undefined);
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
