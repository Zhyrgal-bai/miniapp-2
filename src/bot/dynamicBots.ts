import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { prisma } from "../server/db.js";

/**
 * Мульти-тенант: один процесс Node, много клиентских ботов (по `Business.id`).
 * Продакшен: входящие обновления через `setWebhook` → `handleUpdate`; `launch()` не используется.
 */

/** botId → Telegraf-клиент магазина */
export const activeBots = new Map<number, Telegraf>();

/** На один токен — один активный экземпляр (защита от дубликатов). */
export const activeBotsByToken = new Map<
  string,
  { businessId: number; tg: Telegraf }
>();

/** Альтернативное имя для совместимости с более ранним кодом. */
export const activeDynamicBotsByToken = activeBotsByToken;

/** businessId → токен (для API без хранения в Map активных процессов) */
const tokenByBusinessId = new Map<number, string>();

function trimApiBase(): string {
  return (process.env.API_URL || "").trim().replace(/\/$/, "");
}

export function getDynamicOwnerBot(businessId: number): Telegraf | undefined {
  return activeBots.get(businessId);
}

export function getDynamicTokenForBusiness(businessId: number): string | undefined {
  return tokenByBusinessId.get(businessId);
}

export type RegisterDynamicBotResult = {
  username: string;
  id: number;
};

/**
 * Проставляет `ctx.businessId` для динамического бота (удобно общим middleware).
 */
function attachTenantContext(tgBot: Telegraf, businessId: number): void {
  tgBot.use(async (ctx: Context, next) => {
    (ctx as Context & { businessId?: number }).businessId = businessId;
    await next();
  });
}

/**
 * Подключение бота магазина по токену.
 * Один домен один сервер → вебхук `POST {API_URL}/telegram-webhook/owner/{businessId}`.
 */
export async function registerDynamicUserBot(user: {
  businessId: number;
  botToken: string;
}): Promise<RegisterDynamicBotResult> {
  const token = String(user.botToken).trim();
  if (!token) {
    throw new Error("empty bot token");
  }

  const meRes = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`
  );
  const meJson = (await meRes.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { username?: string; id?: number };
  };
  if (!meRes.ok || !meJson.ok || !meJson.result) {
    throw new Error("Invalid bot token (getMe failed)");
  }

  const existing = activeBots.get(user.businessId);
  const previousTokenForBusiness = tokenByBusinessId.get(user.businessId);
  if (existing) {
    try {
      await existing.telegram.deleteWebhook();
    } catch {
      /* ignore */
    }
    try {
      await existing.stop();
    } catch {
      /* ignore */
    }
    activeBots.delete(user.businessId);
    tokenByBusinessId.delete(user.businessId);
    if (previousTokenForBusiness) {
      activeBotsByToken.delete(previousTokenForBusiness.trim());
    }
  }

  const occupied = activeBotsByToken.get(token);
  if (occupied !== undefined && occupied.businessId !== user.businessId) {
    console.error(
      "registerDynamicUserBot: token already active for another business:",
      occupied.businessId
    );
    throw new Error("bot token already in use by another store");
  }

  let tg: Telegraf;
  try {
    tg = new Telegraf(token);
  } catch (e: unknown) {
    console.error("registerDynamicUserBot: Telegraf init failed:", e);
    throw e;
  }

  const { attachBotHandlers } = await import("./bot.js");
  attachTenantContext(tg, user.businessId);

  try {
    attachBotHandlers(tg, { type: "dynamic", businessId: user.businessId });
    tg.catch((err: unknown) => {
      console.error("dynamic bot middleware error:", user.businessId, err);
    });
    activeBots.set(user.businessId, tg);
    tokenByBusinessId.set(user.businessId, token);
    activeBotsByToken.set(token, {
      businessId: user.businessId,
      tg,
    });
  } catch (e: unknown) {
    console.error("registerDynamicUserBot: attach/handlers failed:", e);
    try {
      await tg.stop();
    } catch {
      /* ignore */
    }
    throw e;
  }

  const publicApiBase = trimApiBase();
  if (publicApiBase) {
    const url = `${publicApiBase}/telegram-webhook/owner/${user.businessId}`;
    try {
      await tg.telegram.setWebhook(url);
      console.log("Dynamic webhook set:", url);
    } catch (e) {
      console.error("Dynamic setWebhook error:", user.businessId, e);
    }
  } else {
    console.warn(
      "API_URL not set — dynamic bot registered without webhook; set API_URL for production"
    );
  }

  /*
   * `bot.launch()` (long polling) не вызываем: все апдейты идут сюда через вебхук.
   * Если понадобится polling (dev), заведите отдельный режим без публичного API_URL.
   */

  return {
    username: String(meJson.result.username ?? ""),
    id: Number(meJson.result.id),
  };
}

/** Корректно остановить все динамические ботов (вебхуки, stop, очистить Map). */
export async function shutdownDynamicUserBots(): Promise<void> {
  for (const [businessId, tg] of [...activeBots.entries()]) {
    try {
      await tg.telegram.deleteWebhook();
    } catch {
      /* ignore */
    }
    try {
      await tg.stop();
    } catch {
      /* ignore */
    }
    const tok = tokenByBusinessId.get(businessId);
    activeBots.delete(businessId);
    tokenByBusinessId.delete(businessId);
    if (tok) activeBotsByToken.delete(tok.trim());
  }
}

/** Загрузить все клиентские боты из БД при старте сервера. */
export async function loadDynamicBotsFromDatabase(): Promise<void> {
  const businesses = await prisma.business.findMany({
    where: { isActive: true },
    select: { id: true, botToken: true },
  });

  for (const business of businesses) {
    const tok = String(business.botToken ?? "").trim();
    if (!tok) continue;

    try {
      await registerDynamicUserBot({
        businessId: business.id,
        botToken: tok,
      });
    } catch (e) {
      console.error("loadDynamicBotsFromDatabase: fail business", business.id, e);
    }
  }
}

/** Совместимое имя (старый вызов из `server/index`). */
export const initDynamicUserBotsFromDatabase = loadDynamicBotsFromDatabase;
