import { getBotForOwner, getBotTokenForOwner, bot, getNotifyTargetChatId } from "../bot/bot.js";
import { findBusinessOwnerTelegramId } from "./tableReservationStaff.js";
import { buildStorefrontReservationPreorderWebAppUrl, buildStorefrontTableBookingWebAppUrl } from "./miniAppUrls.js";

type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };

type InlineKeyboard = {
  inline_keyboard: Array<Array<InlineKeyboardButton>>;
};

async function sendTelegramText(
  chatId: string | number,
  text: string,
  businessId: number,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  const payload: {
    chat_id: string | number;
    text: string;
    reply_markup?: InlineKeyboard;
  } = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const tBot = getBotForOwner(businessId) ?? bot;
  if (tBot) {
    try {
      if (replyMarkup) {
        await tBot.telegram.sendMessage(chatId, text, { reply_markup: replyMarkup });
      } else {
        await tBot.telegram.sendMessage(chatId, text);
      }
      return;
    } catch (e) {
      console.error("tableReservationNotify bot send:", e);
    }
  }
  const token = getBotTokenForOwner(businessId) ?? process.env.BOT_TOKEN?.trim();
  if (!token) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("tableReservationNotify sendMessage failed", res.status, json);
    }
  } catch (e) {
    console.error("tableReservationNotify sendMessage error:", e);
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

async function resolveOwnerChatId(businessId: number): Promise<string | number | null> {
  const ownerTg = await findBusinessOwnerTelegramId(businessId);
  if (ownerTg) return ownerTg;
  const fallback = getNotifyTargetChatId(businessId);
  return fallback ?? null;
}

export async function notifyOwnerNewReservation(input: {
  reservationId: number;
  businessId: number;
  businessName: string;
  guestName: string;
  guestPhone: string;
  tableName: string;
  partySize: number;
  reservedAt: Date;
  guestNote: string | null;
}): Promise<void> {
  const chatId = await resolveOwnerChatId(input.businessId);
  if (chatId == null) {
    console.warn(
      "notifyOwnerNewReservation: no owner chat for business",
      input.businessId,
    );
    return;
  }

  const comment =
    input.guestNote && input.guestNote.trim() !== ""
      ? input.guestNote.trim()
      : "—";

  const text =
    `🍽 Новая бронь\n\n` +
    `Магазин: ${input.businessName}\n\n` +
    `Имя: ${input.guestName}\n` +
    `Телефон: ${input.guestPhone}\n\n` +
    `Стол: ${input.tableName}\n` +
    `Гостей: ${input.partySize}\n\n` +
    `Дата: ${formatDate(input.reservedAt)}\n` +
    `Время: ${formatTime(input.reservedAt)}\n\n` +
    `Комментарий:\n${comment}`;

  const replyMarkup: InlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Подтвердить",
          callback_data: `reservation_confirm_${input.reservationId}`,
        },
        {
          text: "❌ Отклонить",
          callback_data: `reservation_reject_${input.reservationId}`,
        },
      ],
    ],
  };

  await sendTelegramText(chatId, text, input.businessId, replyMarkup);
}

export async function notifyReservationConfirmed(input: {
  reservationId: number;
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `✅ Бронь подтверждена\n\n` +
    `Магазин: ${input.businessName}\n\n` +
    `Стол: ${input.tableName}\n` +
    `Дата: ${formatDate(input.reservedAt)}\n` +
    `Время: ${formatTime(input.reservedAt)}\n\n` +
    `Ждём вас.`;

  const preorderUrl = await buildStorefrontReservationPreorderWebAppUrl(
    input.businessId,
    input.reservationId,
  );
  const replyMarkup: InlineKeyboard | undefined = preorderUrl
    ? {
        inline_keyboard: [
          [{ text: "🍔 Сделать предзаказ", web_app: { url: preorderUrl } }],
        ],
      }
    : undefined;

  await sendTelegramText(tg, text, input.businessId, replyMarkup);
}

export async function notifyReservationDepositRequired(input: {
  reservationId: number;
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
  depositAmountSom: number;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;

  const text =
    `✅ Бронь подтверждена\n\n` +
    `Магазин: ${input.businessName}\n` +
    `Стол: ${input.tableName}\n` +
    `Дата: ${formatDate(input.reservedAt)}\n` +
    `Время: ${formatTime(input.reservedAt)}\n\n` +
    `💳 Для завершения брони\n` +
    `необходимо внести депозит ${input.depositAmountSom} сом.\n\n` +
    `Оплатите в течение 15 минут.`;

  const bookingUrl = await buildStorefrontTableBookingWebAppUrl(input.businessId);
  const replyMarkup: InlineKeyboard | undefined = bookingUrl
    ? {
        inline_keyboard: [
          [{ text: "💳 Оплатить депозит", web_app: { url: bookingUrl } }],
        ],
      }
    : undefined;

  await sendTelegramText(tg, text, input.businessId, replyMarkup);
}

/** After deposit paid — full confirmation + preorder CTA. */
export async function notifyReservationConfirmedAfterDeposit(input: {
  reservationId: number;
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `✅ Депозит оплачен\n\n` +
    `Магазин: ${input.businessName}\n\n` +
    `Стол: ${input.tableName}\n` +
    `Дата: ${formatDate(input.reservedAt)}\n` +
    `Время: ${formatTime(input.reservedAt)}\n\n` +
    `Бронь активна. Ждём вас.`;

  const preorderUrl = await buildStorefrontReservationPreorderWebAppUrl(
    input.businessId,
    input.reservationId,
  );
  const replyMarkup: InlineKeyboard | undefined = preorderUrl
    ? {
        inline_keyboard: [
          [{ text: "🍔 Сделать предзаказ", web_app: { url: preorderUrl } }],
        ],
      }
    : undefined;

  await sendTelegramText(tg, text, input.businessId, replyMarkup);
}

export async function notifyReservationRejected(input: {
  businessId: number;
  guestTelegramId: string;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `❌ Бронь отклонена\n\n` +
    `К сожалению, выбранный столик недоступен.`;
  await sendTelegramText(tg, text, input.businessId);
}

export async function notifyReservationReminder(input: {
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `⏰ Напоминание о брони\n\n` +
    `Через 30 минут ждём вас в ${input.businessName}.\n` +
    `Стол: ${input.tableName}\n` +
    `Время: ${formatTime(input.reservedAt)}`;
  await sendTelegramText(tg, text, input.businessId);
}

export async function notifyReservationCancelled(input: {
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `❌ Бронь отменена\n\n` +
    `${input.businessName}\n` +
    `Стол: ${input.tableName}\n` +
    `Время: ${formatTime(input.reservedAt)}`;
  await sendTelegramText(tg, text, input.businessId);
}

export async function notifyWaitlistInvite(input: {
  entryId: number;
  businessId: number;
  guestTelegramId: string;
  tableName: string;
  partySize: number;
  inviteExpiresAt: Date;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;

  const text =
    `🍽 Освободился столик\n\n` +
    `${input.tableName}\n` +
    `Гостей: ${input.partySize}\n\n` +
    `Подтвердите бронь в течение 15 мин.`;

  const replyMarkup: InlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Забрать столик",
          callback_data: `waitlist_accept_${input.entryId}`,
        },
        {
          text: "❌ Отказаться",
          callback_data: `waitlist_decline_${input.entryId}`,
        },
      ],
    ],
  };

  await sendTelegramText(tg, text, input.businessId, replyMarkup);
}
