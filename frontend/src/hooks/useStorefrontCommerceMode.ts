import { isTelegramMiniAppEnv } from "../utils/telegramSession";

export type StorefrontCommerceMode = "telegram" | "web";

/** Telegram Mini App — полный commerce. Обычный браузер — информационная витрина. */
export function getStorefrontCommerceMode(): StorefrontCommerceMode {
  return isTelegramMiniAppEnv() ? "telegram" : "web";
}

export function isStorefrontCommerceEnabled(): boolean {
  return getStorefrontCommerceMode() === "telegram";
}
