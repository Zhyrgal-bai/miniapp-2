import { readTelegramInitData } from "./telegramSession";

/** Header for backend HMAC verification — signed `Telegram.WebApp.initData` only. */
export function telegramWebAppInitDataHeader(opts?: {
  silent?: boolean;
}): {
  "x-telegram-init-data": string;
} {
  const initData = readTelegramInitData();

  if (initData === "" && opts?.silent !== true) {
    console.warn(
      "[Mini App] initData пустой — откройте из Telegram или дождитесь готовности WebApp.",
    );
  }

  return {
    "x-telegram-init-data": initData,
  };
}
