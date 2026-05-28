import { getBotForOwner, getBotTokenForOwner, bot } from "../bot/bot.js";
import { prisma } from "./db.js";

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
      console.error("venueNotify bot:", e);
    }
  }
  const token = getBotTokenForOwner(businessId) ?? process.env.BOT_TOKEN?.trim();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("venueNotify fetch:", e);
  }
}

export async function notifyTablePaymentRequested(sessionId: number): Promise<void> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: { select: { name: true } },
      business: { select: { id: true, name: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { buyerUser: { select: { telegramId: true } }, total: true },
      },
    },
  });
  if (!session) return;

  const tg = session.orders[0]?.buyerUser?.telegramId;
  if (!tg) return;
  const chat = Number(tg);
  if (!Number.isFinite(chat) || chat <= 0) return;

  const text =
    `💳 Счёт готов к оплате\n\n` +
    `${session.business.name}\n` +
    `Стол: ${session.table.name}\n` +
    `Сумма заказа: ${session.orders[0]?.total ?? 0} сом\n\n` +
    `Оплатите в мини-приложении или у официанта.`;

  await sendTelegramText(chat, text, session.business.id);
}
