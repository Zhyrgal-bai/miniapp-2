import type { Business } from "@prisma/client";
import type { Telegraf } from "telegraf";
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
  const token = String(business.botToken ?? "").trim();
  if (!token) {
    return { ok: false, error: "У магазина нет botToken" };
  }

  try {
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
    const msg = e instanceof Error ? e.message : String(e);
    console.error("launchClientBot failed:", business.id, e);
    return { ok: false, error: msg };
  }
}
