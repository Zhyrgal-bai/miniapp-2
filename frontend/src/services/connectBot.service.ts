import { apiAbsoluteUrl, withTenantHeaders } from "./api";
import { getWebAppUserId } from "../utils/telegramUserId";

function errorMessageFromBody(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return (j.message ?? j.error ?? text) || fallback;
  } catch {
    return text || fallback;
  }
}

export async function postConnectBot(
  botToken: string,
): Promise<{ ok: boolean; shopId: number; botUsername: string }> {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Откройте приложение в Telegram");
  }
  const url = apiAbsoluteUrl("/connect-bot");
  const res = await fetch(url, {
    method: "POST",
    headers: withTenantHeaders({ "Content-Type": "application/json" }, url),
    body: JSON.stringify({ botToken, userId }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromBody(text, res.statusText));
  }
  return JSON.parse(text) as {
    ok: boolean;
    shopId: number;
    botUsername: string;
  };
}
