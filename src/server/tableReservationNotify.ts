import { getBotForOwner, getBotTokenForOwner, bot } from "../bot/bot.js";

async function sendTelegramText(
  chatId: string | number,
  text: string,
  businessId: number,
): Promise<void> {
  const tBot = getBotForOwner(businessId) ?? bot;
  if (tBot) {
    try {
      await tBot.telegram.sendMessage(chatId, text);
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
        body: JSON.stringify({ chat_id: chatId, text }),
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

export async function notifyReservationConfirmed(input: {
  businessId: number;
  businessName: string;
  guestTelegramId: string;
  tableName: string;
  reservedAt: Date;
  partySize: number;
}): Promise<void> {
  const tg = Number(input.guestTelegramId);
  if (!Number.isFinite(tg) || tg <= 0) return;
  const text =
    `🍽 Ваша бронь подтверждена\n\n` +
    `Кафе: ${input.businessName}\n` +
    `Стол: ${input.tableName}\n` +
    `Время: ${formatTime(input.reservedAt)}\n` +
    `Гостей: ${input.partySize}\n` +
    `Дата: ${formatDate(input.reservedAt)}`;
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
