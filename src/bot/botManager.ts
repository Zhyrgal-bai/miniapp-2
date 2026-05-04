import type { Telegraf } from "telegraf";
import {
  activeBots,
  loadDynamicBotsFromDatabase,
  shutdownDynamicUserBots,
} from "./dynamicBots.js";

let shutdownHooksRegistered = false;

/**
 * Менеджер клиентских ботов (multi-tenant).
 * Карта синхронизирована с `dynamicBots.ts` (`activeBots` — один объект).
 *
 * Продакшен: апдейты — `POST …/webhook/<webhookRouteToken>` + проверки secret/rate-limit;
 * временный алиас `…/telegram-webhook/owner/:businessId`.
 * после `setWebhook`. `bot.launch()` (long polling) не используется — иначе дубль с вебхуком.
 */
export { activeBots };

/**
 * Поднять всех ботов магазинов из БД (`isActive`, непустой `botToken`).
 * Вызывать один раз при старте HTTP-сервера.
 */
export async function startAllBots(): Promise<Map<number, Telegraf>> {
  await loadDynamicBotsFromDatabase();
  registerGracefulShutdownOnce();
  return activeBots;
}

/** Если боты поднимаются вручную из `index` (bootstrapBots), всё равно один раз навешиваем SIGINT/SIGTERM. */
export function registerDynamicBotsGracefulShutdownOnce(): void {
  registerGracefulShutdownOnce();
}

function registerGracefulShutdownOnce(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const run = (): void => {
    void shutdownDynamicUserBots().catch((e: unknown) => {
      console.error("[botManager] shutdownDynamicUserBots:", e);
    });
  };

  process.once("SIGINT", run);
  process.once("SIGTERM", run);
}
