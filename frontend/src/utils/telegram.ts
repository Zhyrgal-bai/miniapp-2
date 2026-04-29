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

  if (!tg) {
    console.log("NO TELEGRAM");
    return null;
  }

  console.log("INIT DATA:", tg.initData);
  console.log("INIT DATA UNSAFE:", tg.initDataUnsafe);

  return tg.initDataUnsafe?.user ?? null;
};
