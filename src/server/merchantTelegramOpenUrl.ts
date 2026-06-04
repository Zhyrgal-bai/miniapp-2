import { plainBotTokenFromStored } from "./businessBotToken.js";

async function telegramBotUsername(token: string): Promise<string | null> {
  const trimmed = token.replace(/\s/g, "").trim();
  if (trimmed === "") return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(trimmed)}/getMe`,
    );
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (!res.ok || !j.ok) return null;
    const u = j.result?.username;
    return typeof u === "string" && u.trim() !== "" ? u.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Ссылка для открытия витрины в Telegram (бот мерчанта + startapp tenant).
 * Не отдаём токен бота клиенту — только готовый URL.
 */
export async function buildMerchantTelegramOpenUrl(input: {
  id: number;
  slug: string | null;
  botToken: string;
}): Promise<string | null> {
  const token = plainBotTokenFromStored(input.botToken).trim();
  if (token === "") return null;
  const username = await telegramBotUsername(token);
  if (username == null) return null;

  const slug =
    typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const startapp =
    slug !== "" ? slug : `shop_${Math.trunc(input.id)}`;
  return `https://t.me/${username}?startapp=${encodeURIComponent(startapp)}`;
}
