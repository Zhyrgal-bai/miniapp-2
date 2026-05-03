export type TelegramWebhookInfoParsed = {
  telegramApiOk: boolean;
  webhookUrl: string | null;
  lastErrorMessage: string | null;
};

export async function fetchTelegramWebhookInfo(
  botToken: string,
): Promise<TelegramWebhookInfoParsed> {
  const token = botToken.trim();
  if (!token) {
    return {
      telegramApiOk: false,
      webhookUrl: null,
      lastErrorMessage: "Токен бота не задан",
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getWebhookInfo`,
    );
  } catch {
    return {
      telegramApiOk: false,
      webhookUrl: null,
      lastErrorMessage: "Не удалось связаться с Telegram",
    };
  }

  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: {
      url?: string;
      last_error_message?: string;
    };
  };

  if (!j.ok) {
    const msg =
      typeof j.description === "string" && j.description.trim() !== ""
        ? j.description
        : "Ошибка Telegram API";
    return {
      telegramApiOk: false,
      webhookUrl: null,
      lastErrorMessage: msg,
    };
  }

  const r = j.result;
  const url =
    typeof r?.url === "string" && r.url.trim() !== "" ? r.url.trim() : null;
  const lastErr =
    typeof r?.last_error_message === "string" &&
    r.last_error_message.trim() !== ""
      ? r.last_error_message.trim()
      : null;

  return {
    telegramApiOk: true,
    webhookUrl: url,
    lastErrorMessage: lastErr,
  };
}

/** Для списка и ответа check-webhook: OK только при настроенном URL и без last_error. */
export function classifyWebhookOkError(
  info: TelegramWebhookInfoParsed,
): "OK" | "ERROR" {
  if (!info.telegramApiOk) return "ERROR";
  if (info.webhookUrl == null || info.webhookUrl === "") return "ERROR";
  if (info.lastErrorMessage != null && info.lastErrorMessage !== "")
    return "ERROR";
  return "OK";
}
