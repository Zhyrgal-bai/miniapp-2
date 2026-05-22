import {
  privilegedFetch,
  type PrivilegedFetchInit,
} from "./privilegedFetch";
import { formatHttpStatusError } from "../utils/adminApiError";
import { refreshTelegramSessionAssessment } from "../utils/telegramSession";
import { logTelegramSession } from "../utils/telegramSessionLog";

async function readResponseMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return (j.message ?? j.error ?? text) || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

function bodyLooksLikeTelegramAuthFailure(status: number, body: string): boolean {
  const hint = /telegram|initdata|init.data|авторизац|сессия|x-telegram/i.test(body);
  if (status === 401) return body.trim() === "" || hint;
  if (status === 403) return hint;
  return false;
}

/**
 * Privileged merchant/admin fetch with one auth-session retry after foreground refresh.
 */
export async function adminFetch(
  url: string,
  init: PrivilegedFetchInit = {},
): Promise<Response> {
  let res = await privilegedFetch(url, init);

  if (bodyLooksLikeTelegramAuthFailure(res.status, await res.clone().text())) {
    logTelegramSession("admin_auth_retry", {
      status: res.status,
      path: url.slice(0, 120),
    });
    const refreshed = await refreshTelegramSessionAssessment();
    if (refreshed.wait.ok) {
      res = await privilegedFetch(url, init);
    }
  }

  if (!res.ok) {
    const body = await readResponseMessage(res);
    throw new Error(formatHttpStatusError(res.status, body));
  }

  return res;
}

export async function adminFetchJson<T>(
  url: string,
  init: PrivilegedFetchInit = {},
): Promise<T> {
  const res = await adminFetch(url, init);
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export async function adminFetchVoid(
  url: string,
  init: PrivilegedFetchInit = {},
): Promise<void> {
  await adminFetch(url, init);
}
