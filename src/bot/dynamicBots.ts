import type { MembershipRole } from "@prisma/client";
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

/** Подключение команд /start, Mini App, callbacks — задаётся в `registerDynamicBrain.ts` при старте. */
type AttachDynamicFn = (tg: Telegraf, businessId: number) => void;
let attachDynamicHandlers: AttachDynamicFn | undefined;

/** Вызывается один раз из `registerDynamicBrain.ts` (импорт в `server/index`). */
export function setAttachDynamicHandlers(fn: AttachDynamicFn): void {
  attachDynamicHandlers = fn;
}

function mountDynamicBrain(tgBot: Telegraf, businessId: number): void {
  const attach = attachDynamicHandlers;
  if (attach === undefined) {
    throw new Error(
      "Не подключены обработчики SaaS-бота: добавьте import '../bot/registerDynamicBrain.js' до initDynamicStoreBot (см. server/index)",
    );
  }
  attach(tgBot, businessId);
}

/**
 * Публичный origin для `setWebhook` (без финального `/`).
 * Без циклов с `finikMerchant`: тот же порядок fallback, что у `publicApiOrigin` там.
 */
function publicWebhookBaseUrl(): string {
  const manual = (process.env.API_URL ?? "").trim();
  if (manual) return manual.replace(/\/$/, "");
  const render = (process.env.RENDER_EXTERNAL_URL ?? "").trim();
  if (render) return render.replace(/\/$/, "");
  const base = (process.env.BASE_URL ?? "").trim();
  return base.replace(/\/$/, "");
}

/** Относительный путь webhook в Express: `POST {API_URL}/webhook/:businessId`. */
export function dynamicWebhookPathForBusiness(businessId: number): string {
  return `/webhook/${businessId}`;
}

function dynamicWebhookAbsoluteUrl(publicApiBase: string, businessId: number): string {
  const base = publicApiBase.trim().replace(/\/$/, "");
  return `${base}${dynamicWebhookPathForBusiness(businessId)}`;
}

async function teardownStoreBotSession(businessId: number): Promise<void> {
  const existing = activeBots.get(businessId);
  const previousTokenForBusiness = tokenByBusinessId.get(businessId);
  if (!existing) {
    tokenByBusinessId.delete(businessId);
    if (previousTokenForBusiness) {
      activeBotsByToken.delete(previousTokenForBusiness.trim());
    }
    return;
  }
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
  activeBots.delete(businessId);
  tokenByBusinessId.delete(businessId);
  if (previousTokenForBusiness) {
    activeBotsByToken.delete(previousTokenForBusiness.trim());
  }
}

/** Снять бота из памяти без удаления в Telegram (ручной блок платформы). */
export async function stopDynamicStoreBotInMemory(
  businessId: number,
): Promise<void> {
  await teardownStoreBotSession(businessId);
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
/** Изоляция SaaS: `ctx.businessId` + членство пользователя в этом магазине (`ctx.tenantRole`). */
function attachTenantContext(tgBot: Telegraf, businessId: number): void {
  tgBot.use(async (ctx: Context, next) => {
    const cx = ctx as Context & {
      businessId?: number;
      tenantRole?: MembershipRole | null;
    };
    cx.businessId = businessId;
    cx.tenantRole = null;
    const from = ctx.from?.id;
    if (from != null) {
      const tid = String(from);
      const userRow = await prisma.user.findUnique({
        where: { telegramId: tid },
      });
      const ms =
        userRow == null
          ? null
          : await prisma.membership.findUnique({
              where: {
                userId_businessId: { userId: userRow.id, businessId },
              },
            });
      cx.tenantRole = ms?.role ?? null;
    }
    await next();
  });
}

/**
 * Подключение бота магазина по токену.
 * Экземпляры хранятся в `activeBots` и переиспользуются: при том же токене middleware не дублируется.
 * Webhook: `POST {PUBLIC_URL}/webhook/{businessId}` (старый путь `/telegram-webhook/owner/...` тоже поддерживается).
 */
export async function registerDynamicUserBot(user: {
  businessId: number;
  botToken: string;
}): Promise<RegisterDynamicBotResult> {
  const token = String(user.botToken).trim();
  if (!token) {
    throw new Error("empty bot token");
  }

  const persistent = activeBots.get(user.businessId);
  const persistedToken = tokenByBusinessId.get(user.businessId)?.trim();
  if (persistent !== undefined && persistedToken === token) {
    const publicApiBase = publicWebhookBaseUrl();
    try {
      if (publicApiBase) {
        const url = dynamicWebhookAbsoluteUrl(publicApiBase, user.businessId);
        await persistent.telegram.setWebhook(url);
        console.log(
          "[dynamicBots] Reuse persistent bot, webhook:",
          user.businessId,
          url,
        );
      }
      const info = await persistent.telegram.getMe();
      return {
        username: String(info.username ?? ""),
        id: Number(info.id),
      };
    } catch (e: unknown) {
      console.error(
        "[dynamicBots] Persistent bot failed (re-register):",
        user.businessId,
        e,
      );
      await teardownStoreBotSession(user.businessId);
    }
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

  await teardownStoreBotSession(user.businessId);

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

  attachTenantContext(tg, user.businessId);

  try {
    mountDynamicBrain(tg, user.businessId);
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

  const publicApiBase = publicWebhookBaseUrl();
  if (publicApiBase) {
    const url = dynamicWebhookAbsoluteUrl(publicApiBase, user.businessId);
    try {
      await tg.telegram.setWebhook(url);
      const uname = String(meJson.result.username ?? "");
      console.log(
        "[dynamicBots] Bot instance mapped to business:",
        user.businessId,
        uname !== "" ? `@${uname}` : "(no username)",
        "webhook:",
        url,
      );
    } catch (e) {
      console.error("Dynamic setWebhook error:", user.businessId, e);
    }
  } else {
    console.warn(
      "[dynamicBots] Публичный URL не задан (API_URL / RENDER_EXTERNAL_URL / BASE_URL) — бот в памяти без webhook; задайте переменную для продакшена",
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

/**
 * Горячая активация клиентского бота: `activeBots` + handlers + `setWebhook` без рестарта процесса.
 * Вызывать сразу после `Business` с токеном (одобрение заявки, `/connect-bot`).
 */
export async function initDynamicStoreBot(input: {
  businessId: number;
  botToken: string;
}): Promise<RegisterDynamicBotResult> {
  return registerDynamicUserBot(input);
}

/**
 * Восстановить экземпляр SaaS-бота в памяти процесса (после рестарта, на другом воркере или гонке с одобрением).
 * То же действие что при старте `loadDynamicBotsFromDatabase`; **не вызывает** создание клиента Telegram на каждом апдейте,
 * только если в `activeBots` ещё нет записи.
 */
export async function hydrateDynamicStoreBotIfMissing(
  businessId: number,
): Promise<boolean> {
  if (activeBots.has(businessId)) {
    return true;
  }

  const b = await prisma.business.findFirst({
    where: { id: businessId, isBlocked: false },
    select: { id: true, botToken: true },
  });
  const tok = String(b?.botToken ?? "").trim();
  if (b == null || !tok) {
    return false;
  }

  try {
    await initDynamicStoreBot({ businessId: b.id, botToken: tok });
  } catch (e: unknown) {
    console.error(
      "[dynamicBots] hydrateDynamicStoreBotIfMissing failed:",
      businessId,
      e,
    );
    return false;
  }
  return activeBots.has(businessId);
}

/** Корректно остановить все динамические ботов (вебхуки, stop, очистить Map). */
export async function shutdownDynamicUserBots(): Promise<void> {
  const ids = [...activeBots.keys()];
  for (const businessId of ids) {
    await teardownStoreBotSession(businessId);
  }
}

/** Загрузить все клиентские боты из БД при старте сервера. */
export async function loadDynamicBotsFromDatabase(): Promise<void> {
  const businesses = await prisma.business.findMany({
    where: { isActive: true, isBlocked: false },
    select: { id: true, botToken: true },
  });

  for (const business of businesses) {
    const tok = String(business.botToken ?? "").trim();
    if (!tok) continue;

    try {
      await initDynamicStoreBot({
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
