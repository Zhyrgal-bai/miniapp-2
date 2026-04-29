import "dotenv/config";
import { Telegraf } from "telegraf";
import type { OrderStatus } from "../server/orderStatus.js";
import { prisma } from "../server/db.js";
import { listPaymentDetailsFromDb } from "../server/paymentRepo.js";
import {
  mbankOrderQrImageUrl,
  mbankPaymentQrCaption,
} from "../server/mbankQrUrl.js";
import {
  attachSaasRegistration,
  handleRegistrationCallbacks,
  tryBeginRegistrationFromDeepLink,
} from "./saasRegistration.js";
import {
  getDynamicOwnerBot,
  getDynamicTokenForBusiness,
} from "./dynamicBots.js";

export {
  activeDynamicBotsByToken,
  activeBots,
  activeBotsByToken,
  loadDynamicBotsFromDatabase,
  getDynamicOwnerBot,
  getDynamicTokenForBusiness,
  registerDynamicUserBot,
  initDynamicUserBotsFromDatabase,
  shutdownDynamicUserBots,
} from "./dynamicBots.js";
export type { RegisterDynamicBotResult } from "./dynamicBots.js";

function parseBotTokensFromEnv(): string[] {
  const fromMulti = process.env.BOT_TOKENS?.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (fromMulti && fromMulti.length > 0) return fromMulti;
  const one = process.env.BOT_TOKEN?.trim();
  return one ? [one] : [];
}

/** `BOT_TOKENS` (или один `BOT_TOKEN`) — в том же порядке, что `BOT_OWNER_IDS` / `CHAT_IDS`. */
export const botTokens = parseBotTokensFromEnv();
export const bots: Telegraf[] = botTokens.map((t) => new Telegraf(t));
/** Первый бот — обратная совместимость с одним `BOT_TOKEN`. */
export const bot: Telegraf | undefined = bots[0] ?? undefined;

function parseIdListEnv(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseChatListEnv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * i-й токен = бот i-го магазина (user id владельца).
 * Когда `BOT_OWNER_IDS` пуст, для всех уведомлений используется бот[0] и `CHAT_ID` / `CHAT_IDS[0]`.
 */
export const botOwnerIds: number[] = parseIdListEnv(process.env.BOT_OWNER_IDS);
const chatIdsByIndex: string[] = parseChatListEnv(process.env.CHAT_IDS);

function normalizeChatId(
  c: string | number | undefined
): string | number | undefined {
  if (c === undefined || c === null) return undefined;
  if (typeof c === "number" && Number.isFinite(c)) return c;
  const s = String(c).trim();
  if (s === "") return undefined;
  if (/^-?\d+(\.0+)?$/.test(s)) return Number(s);
  return s;
}

/** Подставляется chat id из `/start` по индексу бота, если `CHAT_ID` не задан. */
const notifyFallbackByIndex = new Map<number, string | number>();
/** Клиентский бот (User.botToken): chat id владельца с `/start`. */
const notifyFallbackByOwnerId = new Map<number, string | number>();
export function getBotIndexForOwner(ownerId: number): number {
  if (botOwnerIds.length === 0) return 0;
  const i = botOwnerIds.indexOf(ownerId);
  return i >= 0 ? i : 0;
}

export function getBotForOwner(ownerId: number): Telegraf | undefined {
  const dyn = getDynamicOwnerBot(ownerId);
  if (dyn) return dyn;
  if (bots.length === 0) return undefined;
  return bots[getBotIndexForOwner(ownerId)] ?? bots[0];
}

export function getBotTokenForOwner(ownerId: number): string | undefined {
  const t = getDynamicTokenForBusiness(ownerId);
  if (t) return t;
  if (botTokens.length === 0) return undefined;
  return botTokens[getBotIndexForOwner(ownerId)] ?? botTokens[0];
}

/**
 * Куда писать админу: по владельцу заказа / магазина, или глобальный `CHAT_ID`, или кто нажал /start.
 */
export function getNotifyTargetChatId(
  ownerId?: number
): string | number | undefined {
  if (ownerId != null && botOwnerIds.length > 0) {
    const i = botOwnerIds.indexOf(ownerId);
    if (i >= 0) {
      if (i < chatIdsByIndex.length && String(chatIdsByIndex[i] ?? "").trim() !== "")
        return normalizeChatId(chatIdsByIndex[i]);
      if (notifyFallbackByIndex.has(i))
        return notifyFallbackByIndex.get(i);
    }
  }
  if (ownerId != null && notifyFallbackByOwnerId.has(ownerId)) {
    return notifyFallbackByOwnerId.get(ownerId);
  }
  const env = process.env.CHAT_ID;
  if (env != null && String(env).trim() !== "")
    return normalizeChatId(String(env).trim());
  if (ownerId != null && botOwnerIds.length > 0) {
    const i = botOwnerIds.indexOf(ownerId);
    if (i >= 0 && notifyFallbackByIndex.has(i))
      return notifyFallbackByIndex.get(i);
  }
  if (notifyFallbackByIndex.has(0)) return notifyFallbackByIndex.get(0);
  for (const v of notifyFallbackByIndex.values()) {
    if (v != null) return v;
  }
  return undefined;
}

/** Этап 2: одна строка — как в ТЗ (новый заказ + сообщение «клиент оплатил»). */
export function adminConfirmPaymentOnlyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [
        {
          text: "💰 Подтвердить оплату",
          callback_data: `confirm_${orderId}`,
        },
      ],
    ],
  };
}

/** Этап 3: одна строка «Отправлено» (как в ТЗ). */
export function adminShipOnlyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "🚚 Отправлено", callback_data: `ship_${orderId}` }],
    ],
  };
}

/** Уведомление админу о новом заказе: этапы 2–3 + принять/отклонить. */
export function adminNewOrderNotifyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      ...adminConfirmPaymentOnlyKeyboard(orderId).inline_keyboard,
      [
        { text: "✅ Принять", callback_data: `accept_${orderId}` },
        { text: "❌ Отклонить", callback_data: `cancel_${orderId}` },
      ],
      ...adminShipOnlyKeyboard(orderId).inline_keyboard,
    ],
  };
}

/** @deprecated для новых заказов используйте adminNewOrderNotifyKeyboard */
export function adminOrderInlineKeyboard(orderId: number) {
  return adminNewOrderNotifyKeyboard(orderId);
}

/** @deprecated используйте adminOrderInlineKeyboard */
export const adminMemoryOrderInlineKeyboard = adminOrderInlineKeyboard;

async function loadOrderForBot(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { buyerUser: true, items: true },
  });
}

function buyerTelegramFromOrderRow(row: {
  buyerUser: { telegramId: string } | null;
}): number | null {
  const raw = row.buyerUser?.telegramId;
  if (raw === undefined || raw === null || String(raw).trim() === "")
    return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function updateOrderStatusInDb(orderId: number, status: OrderStatus) {
  const row = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { buyerUser: true, items: true },
  });
  console.log("ORDER STATUS UPDATE:", orderId, status);
  return row;
}

const DEFAULT_MBANK_FALLBACK = "0556996312";

/** Кнопка «Я оплатил» после перевода в ACCEPTED. */
export function yaOpltilKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "💰 Я оплатил", callback_data: `paid_${orderId}` }],
    ],
  };
}

async function buildAcceptedPaymentMessage(
  orderId: number,
  businessId: number,
  orderTotal: number
): Promise<{ text: string; qrUrl: string; qrCaption: string }> {
  const details = await listPaymentDetailsFromDb(prisma, businessId);
  const mbankRow = details.find((d) => d.type.toLowerCase() === "mbank");
  const mbankVal =
    mbankRow?.value?.trim() && mbankRow.value.trim().length > 0
      ? mbankRow.value.trim()
      : DEFAULT_MBANK_FALLBACK;
  const text =
    `💳 Оплата заказа #${orderId}\n\n` +
    `Сумма: ${orderTotal} сом\n\n` +
    `MBANK: ${mbankVal}\n\n` +
    `👇 После оплаты нажмите:`;
  return {
    text,
    qrUrl: mbankOrderQrImageUrl(orderTotal),
    qrCaption: mbankPaymentQrCaption(orderId, orderTotal),
  };
}

async function sendMbankAmountQrPhoto(
  telegram: Telegraf["telegram"],
  tgId: number,
  qrUrl: string,
  qrCaption: string
): Promise<void> {
  try {
    await telegram.sendPhoto(tgId, qrUrl, { caption: qrCaption });
  } catch (e) {
    console.error("sendPhoto MBANK QR failed:", e);
  }
}

/** Сообщение об оплате + кнопка «Я оплатил» (этап 1) — после ACCEPTED. */
export async function sendAcceptedPaymentPromptToTelegramUser(params: {
  telegram: Telegraf["telegram"];
  telegramUserId: number;
  orderId: number;
  businessId: number;
  orderTotal: number;
}): Promise<void> {
  const { telegram, telegramUserId, orderId, businessId, orderTotal } = params;
  const { text, qrUrl, qrCaption } = await buildAcceptedPaymentMessage(
    orderId,
    businessId,
    orderTotal
  );
  await telegram.sendMessage(telegramUserId, text, {
    reply_markup: yaOpltilKeyboard(orderId),
  });
  await sendMbankAmountQrPhoto(telegram, telegramUserId, qrUrl, qrCaption);
}

/** То же при смене статуса через API (нет ctx.telegram). */
export async function sendAcceptedPaymentPromptForOrderFromApi(order: {
  id: number;
  businessId: number;
  total: number;
  buyerUser?: { telegramId: string } | null;
  paymentMethod?: string | null;
}): Promise<void> {
  if (String(order.paymentMethod ?? "").toLowerCase() === "finik") {
    return;
  }
  const rawTg = order.buyerUser?.telegramId;
  const tgId = rawTg !== undefined ? Number(rawTg) : NaN;
  if (!Number.isFinite(tgId) || tgId <= 0) return;
  const { text, qrUrl, qrCaption } = await buildAcceptedPaymentMessage(
    order.id,
    order.businessId,
    order.total
  );
  const tBot = getBotForOwner(order.businessId);
  if (tBot) {
    await tBot.telegram.sendMessage(tgId, text, {
      reply_markup: yaOpltilKeyboard(order.id),
    });
    await sendMbankAmountQrPhoto(tBot.telegram, tgId, qrUrl, qrCaption);
    return;
  }

  const token = getBotTokenForOwner(order.businessId);
  if (!token) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgId,
          text,
          reply_markup: yaOpltilKeyboard(order.id),
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("sendAcceptedPayment sendMessage failed", res.status, json);
    }
  } catch (e) {
    console.error("sendAcceptedPayment sendMessage error:", e);
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgId,
          photo: qrUrl,
          caption: qrCaption,
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("sendPhoto MBANK QR (http) failed", res.status, json);
    }
  } catch (e) {
    console.error("sendPhoto MBANK QR (http) error:", e);
  }
}

function readStartParam(ctx: {
  message?: { text?: string };
  [key: string]: unknown;
}): string | undefined {
  const t = (ctx as { startPayload?: string }).startPayload;
  if (typeof t === "string" && t.trim() !== "") return t.trim();
  const p = (ctx as { startParam?: string }).startParam;
  if (typeof p === "string" && p.trim() !== "") return p.trim();
  const text = (ctx as { message?: { text?: string } }).message?.text;
  if (typeof text === "string" && text.startsWith("/start ")) {
    return text.slice(7).trim() || undefined;
  }
  return undefined;
}

type BotHandlerRole =
  | { type: "env"; botIndex: number }
  | { type: "dynamic"; businessId: number };

export function attachBotHandlers(tgBot: Telegraf, role: BotHandlerRole): void {
  attachSaasRegistration(tgBot, role);

  void tgBot.telegram
    .getMe()
    .then((info) => {
      if (role.type === "env") {
        console.log("BOT INFO:", role.botIndex, info.username, info.id);
      } else {
        console.log(
          "BOT INFO (dynamic):",
          "owner",
          role.businessId,
          info.username,
          info.id
        );
      }
    })
    .catch((err) => {
      if (role.type === "env") {
        console.error("BOT ERROR:", role.botIndex, err);
      } else {
        console.error("BOT ERROR (dynamic) business", role.businessId, err);
      }
    });

  tgBot.start(async (ctx) => {
    if (await tryBeginRegistrationFromDeepLink(role, ctx)) {
      return;
    }
    const chatId = ctx.chat?.id;
    if (role.type === "env") {
      if (chatId != null) {
        notifyFallbackByIndex.set(role.botIndex, chatId);
        console.log(
          "NOTIFY_FALLBACK chat set from /start, bot",
          role.botIndex,
          chatId
        );
      }
    } else {
      if (chatId != null) {
        notifyFallbackByOwnerId.set(role.businessId, chatId);
        console.log(
          "NOTIFY_FALLBACK (dynamic) business",
          role.businessId,
          chatId
        );
      }
    }
    const param = readStartParam(ctx as { message?: { text?: string } });
    let shop = "";
    if (param && param.startsWith("shop_")) {
      shop = param.slice(5);
    } else if (role.type === "dynamic") {
      shop = String(role.businessId);
    }
    const base = (process.env.FRONT_URL || process.env.PUBLIC_URL || "")
      .trim()
      .replace(/\/$/, "");
    if (shop && base) {
      const url = `${base}/?shop=${encodeURIComponent(shop)}`;
      void ctx.reply("Открыть магазин", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Открыть", web_app: { url } }],
          ],
        },
      });
    } else {
      void ctx.reply(
        "Бот работает ✅" +
          (shop && !base
            ? "\n(Задайте FRONT_URL в .env для кнопки веб-аппа.)"
            : "")
      );
    }
  });

  tgBot.on("message", (ctx) => {
    console.log("USER ID:", ctx.from.id);
  });

  tgBot.on("callback_query", async (ctx) => {
    try {
      if (!("data" in ctx.callbackQuery)) return;

      const data = ctx.callbackQuery.data;
      if (!data) return;

      if (await handleRegistrationCallbacks(ctx)) {
        return;
      }

      const msg = ctx.callbackQuery.message;
      if (!msg || !("text" in msg)) {
        await ctx.answerCbQuery("Сообщение недоступно");
        return;
      }

      const underscore = data.indexOf("_");
      if (underscore < 0) {
        await ctx.answerCbQuery("Неверные данные");
        return;
      }
      const action = data.slice(0, underscore);
      const orderIdStr = data.slice(underscore + 1);
      const orderId = Number(orderIdStr);

      if (!orderIdStr || !Number.isFinite(orderId)) {
        await ctx.answerCbQuery("Неверные данные");
        return;
      }

      const row = await loadOrderForBot(orderId);
      if (!row) {
        await ctx.answerCbQuery("Заказ не найден");
        return;
      }

      const buyerTg = buyerTelegramFromOrderRow(row);
      const order = {
        status: row.status as OrderStatus,
        customerTelegramId: buyerTg ?? Number.NaN,
      };

      console.log("CALLBACK:", data, "order", orderId, "status", order.status);

      // ---------- ACCEPT (админ) ----------
      if (action === "accept") {
        if (order.status !== "NEW") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        const rowAfter = await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`🟢 Заказ #${orderId} принят. Ожидаем оплату.`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          if (String(row.paymentMethod ?? "").toLowerCase() === "finik") {
            await ctx.telegram.sendMessage(
              tgId,
              `✅ Заказ #${orderId} принят.\n\n` +
                `Оплата через Finik: после оплаты статус обновится автоматически. ` +
                `Откройте мини-приложение → «Мои заказы».`
            );
          } else {
            await sendAcceptedPaymentPromptToTelegramUser({
              telegram: ctx.telegram,
              telegramUserId: tgId,
              orderId: rowAfter.id,
              businessId: rowAfter.businessId,
              orderTotal: rowAfter.total,
            });
          }
        }

        await ctx.answerCbQuery("Обновлено ✅");
        return;
      }

      // ---------- SHIP (админ) — callback_data: ship_${orderId} ----------
      if (action === "ship" || action === "done" || data.startsWith("ship_")) {
        if (order.status === "SHIPPED") {
          await ctx.answerCbQuery("Уже отправлено");
          return;
        }
        if (order.status !== "CONFIRMED") {
          await ctx.answerCbQuery("Сначала подтвердите оплату");
          return;
        }

        const rowAfter = await updateOrderStatusInDb(orderId, "SHIPPED");

        await ctx.editMessageText(`🚚 Заказ #${orderId} отправлен`, {
          reply_markup: { inline_keyboard: [] },
        });

        const shipTg = buyerTelegramFromOrderRow(rowAfter);
        if (shipTg != null && shipTg > 0) {
          await ctx.telegram.sendMessage(
            shipTg,
            `🚚 Заказ отправлен!\n\nВаш заказ #${rowAfter.id} уже в пути 📦`
          );
        }

        await ctx.answerCbQuery("Заказ отправлен 🚚");
        return;
      }

      // ---------- PAID (клиент) ----------
      if (action === "paid") {
        if (!Number.isFinite(order.customerTelegramId)) {
          await ctx.answerCbQuery("Заказ без привязки к Telegram");
          return;
        }
        if (ctx.from?.id !== order.customerTelegramId) {
          await ctx.answerCbQuery("Нет доступа");
          return;
        }
        if (order.status !== "ACCEPTED") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        await updateOrderStatusInDb(orderId, "PAID_PENDING");

        await ctx.editMessageText(
          `💳 Оплата заказа #${orderId}\n\nЗаявка отправлена администратору. Ожидайте подтверждения.`,
          { reply_markup: { inline_keyboard: [] } }
        );

        const adminChat = getNotifyTargetChatId(row.businessId);
        if (adminChat == null) {
          console.error(
            "CHAT_ID не задан и не было /start — не удалось уведомить админа об оплате"
          );
        } else {
          await ctx.telegram.sendMessage(
            adminChat,
            `💰 Клиент оплатил заказ #${orderId}\nПроверь оплату`,
            {
              reply_markup: {
                inline_keyboard: [
                  ...adminConfirmPaymentOnlyKeyboard(orderId).inline_keyboard,
                  [
                    {
                      text: "❌ Отклонить",
                      callback_data: `cancel_${orderId}`,
                    },
                  ],
                ],
              },
            }
          );
        }

        await ctx.answerCbQuery("Ожидайте подтверждения 🙏");
        return;
      }

      // ---------- CONFIRM (админ) — callback_data: confirm_${orderId} ----------
      if (action === "confirm" || data.startsWith("confirm_")) {
        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery(
            order.status === "NEW"
              ? "Сначала примите заказ и дождитесь оплаты"
              : "Уже обработано"
          );
          return;
        }

        const rowAfter = await updateOrderStatusInDb(orderId, "CONFIRMED");

        await ctx.editMessageText(`🟢 Оплата подтверждена · заказ #${orderId}`, {
          reply_markup: adminShipOnlyKeyboard(orderId),
        });

        const confTg = buyerTelegramFromOrderRow(rowAfter);
        if (confTg != null && confTg > 0) {
          await ctx.telegram.sendMessage(
            confTg,
            `💰 Оплата подтверждена!\n\nВаш заказ #${rowAfter.id} готовится к отправке 📦`
          );
        }

        await ctx.answerCbQuery("Оплата подтверждена ✅");
        return;
      }

      // ---------- CANCEL / REJECT (админ): отмена NEW или отклонение оплаты ----------
      if (action === "reject" || action === "cancel") {
        if (order.status === "NEW") {
          await updateOrderStatusInDb(orderId, "CANCELLED");

          await ctx.editMessageText(`❌ Заказ #${orderId} отклонён`, {
            reply_markup: { inline_keyboard: [] },
          });

          const tgId = order.customerTelegramId;
          if (tgId != null && Number.isFinite(tgId)) {
            await ctx.telegram.sendMessage(
              tgId,
              "❌ Заказ отклонён администратором."
            );
          }

          await ctx.answerCbQuery("Обновлено ✅");
          return;
        }

        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery("Недоступно для этого статуса");
          return;
        }

        const rowBack = await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`❌ Оплата не подтверждена\nЗаказ #${orderId}`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await sendAcceptedPaymentPromptToTelegramUser({
            telegram: ctx.telegram,
            telegramUserId: tgId,
            orderId: rowBack.id,
            businessId: rowBack.businessId,
            orderTotal: rowBack.total,
          });
        }

        await ctx.answerCbQuery("Обновлено ✅");
        return;
      }

      await ctx.answerCbQuery();
    } catch (error) {
      console.error("CALLBACK ERROR:", error);
      try {
        await ctx.answerCbQuery("Ошибка");
      } catch {
        /* ignore */
      }
    }
  });
}

bots.forEach((tgBot, botIndex) => {
  attachBotHandlers(tgBot, { type: "env", botIndex });
});
