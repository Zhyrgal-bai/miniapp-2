import type { Business } from "@prisma/client";
import type { Telegraf } from "telegraf";
import {
  activeBots,
  registerDynamicUserBot,
  type RegisterDynamicBotResult,
} from "./dynamicBots.js";

export type LaunchClientBotOutcome = {
  bot: Telegraf;
} & RegisterDynamicBotResult;

/**
 * Запускает клиентского бота после SaaS-одобрения: токен из записи Business.
 *
 * На продакшене обновления идут через **webhook** (`setWebhook`), а не через
 * `bot.launch()` — иначе дублирование с вебхуком и несколько процессов на Render сломают доставку.
 * Внутри вызывается `registerDynamicUserBot` → полный `attachBotHandlers` + Mini App-кнопка на `/start`.
 */
export async function launchClientBot(
  business: Pick<Business, "id" | "botToken">
): Promise<LaunchClientBotOutcome | undefined> {
  const token = String(business.botToken ?? "").trim();
  if (!token) return undefined;

  try {
    const result = await registerDynamicUserBot({
      businessId: business.id,
      botToken: token,
    });
    const bot = activeBots.get(business.id);
    if (!bot) {
      console.error(
        "launchClientBot: Telegraf отсутствует в карте после register",
        business.id
      );
      return undefined;
    }
    console.log("Client bot started (webhook):", business.id, result.username);
    return { bot, ...result };
  } catch (e) {
    console.error("launchClientBot failed:", business.id, e);
    return undefined;
  }
}
