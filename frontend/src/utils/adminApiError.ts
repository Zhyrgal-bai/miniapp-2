import axios from "axios";

export const TELEGRAM_SESSION_RU =
  "Сессия Telegram устарела. Закройте Mini App и откройте снова из бота.";

export function formatHttpStatusError(status: number, body: string): string {
  if (status === 401) return TELEGRAM_SESSION_RU;
  if (status === 403) return "Недостаточно прав для этого действия.";
  const trimmed = body.trim();
  if (trimmed.length > 0 && trimmed.length < 240) return trimmed;
  if (status >= 500) return "Ошибка сервера. Попробуйте позже.";
  return "Не удалось выполнить запрос.";
}

export function formatAdminApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined;
    const body =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      error.message;
    if (status != null) return formatHttpStatusError(status, body);
    if (/network error/i.test(error.message)) {
      return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
    }
    return body || "Не удалось выполнить запрос.";
  }
  if (error instanceof Error) {
    if (/401|unauthorized|initdata/i.test(error.message)) {
      return TELEGRAM_SESSION_RU;
    }
    return error.message;
  }
  return "Не удалось выполнить запрос.";
}
