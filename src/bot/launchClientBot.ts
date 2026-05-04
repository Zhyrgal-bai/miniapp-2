import type { Business } from "@prisma/client";
import type { Telegraf } from "telegraf";
import { plainBotTokenFromStored } from "../server/businessBotToken.js";
import { isEncryptedTokenFormat } from "../server/botTokenCrypto.js";
import {
  activeBots,
  initDynamicStoreBot,
  type RegisterDynamicBotResult,
} from "./dynamicBots.js";

export type LaunchClientBotOutcome = {
  bot: Telegraf;
} & RegisterDynamicBotResult;

export type LaunchClientBotResult =
  | ({ ok: true } & LaunchClientBotOutcome)
  | { ok: false; error: string };

/**
 * Мгновенная активация клиентского бота после создания Business (без рестарта сервера).
 * Webhook задаётся внутри `initDynamicStoreBot`; polling не используется.
 */
export async function launchClientBot(
  business: Pick<Business, "id" | "botToken">
): Promise<LaunchClientBotResult> {
  let token: string;
  try {
    token = plainBotTokenFromStored(business.botToken);
  } catch (e: unknown) {
    console.error("BOT LAUNCH ERROR:", e);
    const msg =
      e instanceof Error ? e.message : "Не удалось расшифровать botToken";
    return { ok: false, error: msg };
  }

  token = token.trim().replace(/^[\uFEFF\s]+/, "");
  if (!token) {
    return { ok: false, error: "У магазина нет botToken" };
  }

  if (isEncryptedTokenFormat(token)) {
    console.error(
      "BOT LAUNCH ERROR: token still ciphertext (encrypt/key/dataset mismatch)",
      business.id,
    );
    return {
      ok: false,
      error:
        "botToken не расшифрован для Telegram (остался enc:v1:…) — BOT_TOKEN_SECRET_KEY",
    };
  }

  try {
    console.log("CREATING BOT INSTANCE");
    const result = await initDynamicStoreBot({
      businessId: business.id,
      botToken: token,
    });
    const bot = activeBots.get(business.id);
    if (!bot) {
      const msg = "Telegraf отсутствует в карте после initDynamicStoreBot";
      console.error("launchClientBot:", business.id, msg);
      return { ok: false, error: msg };
    }
    console.log(
      "[launchClientBot] Instant activation:",
      business.id,
      `@${result.username}`
    );
    return { ok: true, bot, ...result };
  } catch (e: unknown) {
    console.error("BOT LAUNCH ERROR:", e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error("launchClientBot failed:", business.id, e);
    return { ok: false, error: msg };
  }
}
