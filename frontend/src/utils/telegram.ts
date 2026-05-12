import { getWebAppUserId } from "./telegramUserId";

export type TelegramMiniAppUser = TelegramWebAppUser;

/** Telegram Mini App: тот же `userId`, что и в `getWebAppUserId()`. */
export function getTelegramWebAppUserId(): number {
  return getWebAppUserId();
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export const getTelegramUser = (): TelegramWebAppUser | null => {
  const tg = getTelegramWebApp();
  const raw = tg?.initData?.trim() ?? "";
  if (raw === "") return null;
  try {
    const userJson = new URLSearchParams(raw).get("user");
    if (!userJson?.trim()) return null;
    return JSON.parse(userJson) as TelegramWebAppUser;
  } catch {
    return null;
  }
};
