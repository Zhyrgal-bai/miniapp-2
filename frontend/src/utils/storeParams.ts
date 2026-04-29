import { getWebAppUserId } from "./telegramUserId";

const STORAGE_KEY = "miniapp-active-shop";

/** `?shop=<ownerId>` — витрина этого магазина; кладём в sessionStorage, чтобы не терялось при навигации. */
export function getActiveShopId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const q = new URLSearchParams(window.location.search).get("shop");
  if (q && /^\d+$/.test(q)) {
    sessionStorage.setItem(STORAGE_KEY, q);
    return q;
  }
  const s = sessionStorage.getItem(STORAGE_KEY);
  return s && /^\d+$/.test(s) ? s : undefined;
}

/** Параметры для публичного каталога: `shop` и/или `userId` (Telegram). */
export function buildCatalogRequestParams(): Record<string, string> {
  const shop = getActiveShopId();
  const uid = getWebAppUserId();
  const p: Record<string, string> = {};
  if (shop) p.shop = shop;
  if (Number.isFinite(uid) && uid > 0) p.userId = String(uid);
  return p;
}
