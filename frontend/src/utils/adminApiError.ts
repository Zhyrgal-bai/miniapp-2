import axios from "axios";

/** Merchant-facing message when privileged API returns 401/403 Telegram auth. */
export const TELEGRAM_SESSION_RU =
  "Сессия Telegram недоступна. Закройте Mini App и откройте снова из бота.";

const GENERIC_FAIL = "Не удалось выполнить запрос.";

/** Legacy English backend strings → RU (regression safety net). */
const LEGACY_EN_TO_RU: Record<string, string> = {
  "server error": "Сервер временно недоступен. Попробуйте через минуту.",
  "not found": "Не найдено",
  forbidden: "Недостаточно прав",
  "store unavailable": "Магазин недоступен",
  "business not found": "Магазин не найден",
  "invalid businessid": "Некорректный id магазина",
  "invalid business id": "Некорректный id магазина",
  "missing tenant shop": "Не указан магазин",
  "missing tenant: pass shop or businessid in query":
    "Укажите shop или businessId в запросе",
  "invalid operator password": "Неверный пароль оператора",
  "invalid slug": "Некорректный адрес магазина",
  "invalid id": "Некорректный id",
  "webhook error": "Ошибка обработки webhook",
  "invalid signature": "Неверная подпись",
};

function sanitizeMerchantMessage(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  const legacy = LEGACY_EN_TO_RU[t.toLowerCase()];
  if (legacy) return legacy;
  if (/^server error$/i.test(t)) return "";
  if (/^request failed with status code \d+$/i.test(t)) return "";
  if (/^network error$/i.test(t)) return "";
  if (/^http \d{3}$/i.test(t)) return "";
  if (t.length > 320) return `${t.slice(0, 300)}…`;
  return t;
}

function messageFromResponseBody(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return sanitizeMerchantMessage(data);
  if (typeof data === "object") {
    const o = data as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return sanitizeMerchantMessage(o.message);
    if (typeof o.error === "string") return sanitizeMerchantMessage(o.error);
  }
  return "";
}

export function formatHttpStatusError(status: number, body: string): string {
  const parsed = sanitizeMerchantMessage(body);

  if (status === 401) {
    if (/telegram|initdata|init.data|авторизац|сессия|x-telegram/i.test(parsed)) {
      return TELEGRAM_SESSION_RU;
    }
    return parsed || "Требуется авторизация.";
  }
  if (status === 403) {
    if (/telegram|initdata|init.data|авторизац|сессия|x-telegram/i.test(parsed)) {
      return TELEGRAM_SESSION_RU;
    }
    return parsed || "Недостаточно прав для этого действия.";
  }
  if (status === 404) return parsed || "Данные не найдены.";
  if (status === 409) return parsed || "Конфликт данных. Обновите страницу и попробуйте снова.";
  if (status === 429) return parsed || "Слишком много запросов. Подождите немного.";
  if (status >= 500) {
    return parsed || "Сервер временно недоступен. Попробуйте через минуту.";
  }
  return parsed || GENERIC_FAIL;
}

export function formatAdminApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = messageFromResponseBody(error.response?.data) || error.message;
    if (status != null) return formatHttpStatusError(status, body);
    if (/network error|err_network|econnaborted/i.test(error.message)) {
      return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
    }
    return sanitizeMerchantMessage(body) || GENERIC_FAIL;
  }

  if (error instanceof Error) {
    const raw = error.message;
    if (/401|unauthorized|initdata|init\.data|telegram|сессия telegram/i.test(raw)) {
      return TELEGRAM_SESSION_RU;
    }
    const msg = sanitizeMerchantMessage(raw);
    if (/network error|failed to fetch|load failed/i.test(msg)) {
      return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
    }
    return msg || GENERIC_FAIL;
  }

  return GENERIC_FAIL;
}

/** Storefront + admin unified merchant-facing error text. */
export const formatApiError = formatAdminApiError;
