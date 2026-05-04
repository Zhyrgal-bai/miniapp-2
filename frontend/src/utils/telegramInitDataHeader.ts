/** Заголовок для проверки подписи Mini App на сервере (`requireTelegramAuth`). */
export function telegramWebAppInitDataHeader(): {
  "x-telegram-init-data": string;
} {
  return {
    "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "",
  };
}
