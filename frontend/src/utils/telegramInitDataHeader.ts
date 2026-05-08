/** Заголовок для проверки подписи Mini App (`requireTelegramAuth`). Только подписанная строка `initData`, не initDataUnsafe. */
export function telegramWebAppInitDataHeader(): {
  "x-telegram-init-data": string;
} {
  const tg =
    typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

  const initData = tg?.initData ?? "";

  if (initData === "") {
    console.warn(
      "[Mini App] initData пустой — приложение открыто не из Telegram или WebApp.ready() ещё не подготовил данные.",
    );
  }

  return {
    "x-telegram-init-data": initData,
  };
}
