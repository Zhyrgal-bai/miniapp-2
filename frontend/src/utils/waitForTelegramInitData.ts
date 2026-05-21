import { telegramWebAppInitDataHeader } from "./telegramInitDataHeader";

export type WaitForInitDataOptions = {
  maxAttempts?: number;
  delayMs?: number;
  minLength?: number;
};

/** Ждёт появления подписанной строки `Telegram.WebApp.initData` (Mini App cold start). */
export async function waitForTelegramInitData(
  options: WaitForInitDataOptions = {},
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 20;
  const delayMs = options.delayMs ?? 150;
  const minLength = options.minLength ?? 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const initData = telegramWebAppInitDataHeader()["x-telegram-init-data"];
    if (initData.trim().length >= minLength) return initData;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return telegramWebAppInitDataHeader()["x-telegram-init-data"];
}

export function hasVerifiedTelegramInitData(initData: string): boolean {
  return initData.trim().length >= 20;
}
