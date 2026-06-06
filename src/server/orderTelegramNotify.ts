import {
  bot,
  getBotForOwner,
  getBotTokenForOwner,
  getNotifyTargetChatId,
  sendAcceptedPaymentPromptForOrderFromApi,
  adminMiniAppNotifyKeyboard,
} from "../bot/bot.js";
import type { OrderStatus } from "./orderStatus.js";
import { orderDisplayLabel, formatNewOrderTelegramMessage } from "./orderNumber.js";
import { buildMerchantAdminOrdersWebAppUrl } from "./miniAppUrls.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";
import { prisma } from "./db.js";

function customerTextForStatus(
  status: OrderStatus,
  label: string
): string | null {
  if (status === "ACCEPTED") return "Заказ принят";
  if (status === "CONFIRMED") {
    return `Оплата подтверждена ✅\n\nВаш заказ ${label} готовится к отправке 📦`;
  }
  if (status === "SHIPPED") {
    return `🚚 Заказ отправлен!\n\nВаш заказ ${label} уже в пути 📦`;
  }
  if (status === "DELIVERED") {
    return `✅ Заказ доставлен!\n\nВаш заказ ${label} — возврат при необходимости в «Мои заказы».`;
  }
  return null;
}

async function sendTelegramText(
  chatId: string | number,
  text: string,
  businessId?: number
): Promise<void> {
  const token =
    (businessId != null ? getBotTokenForOwner(businessId) : undefined) ||
    process.env.BOT_TOKEN?.trim() ||
    process.env.BOT_TOKENS?.split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
  if (!token) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("TELEGRAM sendMessage failed", res.status, json);
    }
  } catch (e) {
    console.error("TELEGRAM sendMessage error:", e);
  }
}

/**
 * После смены статуса через API (мини-апп / админка): уведомить клиента и админ-чат.
 */
export async function notifyAfterOrderStatusChangeFromApi(order: {
  id: number;
  orderNumber?: string | null;
  businessId: number;
  status: string;
  total: number;
  buyerUser: { telegramId: string } | null;
  paymentMethod?: string | null;
}): Promise<void> {
  const status = order.status as OrderStatus;
  const label = orderDisplayLabel(order);
  const rawTg = order.buyerUser?.telegramId;
  const tgId = rawTg !== undefined ? Number(rawTg) : NaN;
  const isFinik = String(order.paymentMethod ?? "").toLowerCase() === "finik";

  if (status === "ACCEPTED" && Number.isFinite(tgId) && tgId > 0) {
    try {
      if (isFinik) {
        const text =
          `✅ Заказ ${label} принят.\n\n` +
          `Оплата через Finik: после оплаты статус обновится автоматически. ` +
          `Следите в мини-приложении → «Мои заказы».`;
        const tBot = getBotForOwner(order.businessId) ?? bot;
        if (tBot) {
          await tBot.telegram.sendMessage(tgId, text);
        } else {
          await sendTelegramText(tgId, text, order.businessId);
        }
      } else {
        await sendAcceptedPaymentPromptForOrderFromApi({
          id: order.id,
          orderNumber: order.orderNumber ?? null,
          businessId: order.businessId,
          total: order.total,
          buyerUser: order.buyerUser,
          paymentMethod: order.paymentMethod ?? null,
        });
      }
    } catch (e) {
      console.error("notify customer ACCEPTED payment prompt:", e);
    }
  } else {
    const text = customerTextForStatus(status, label);
    if (text != null && Number.isFinite(tgId) && tgId > 0) {
      const tBot = getBotForOwner(order.businessId) ?? bot;
      if (tBot) {
        try {
          await tBot.telegram.sendMessage(tgId, text);
        } catch (e) {
          console.error("notify customer (bot):", e);
        }
      } else {
        await sendTelegramText(tgId, text, order.businessId);
      }
    }
  }

  const adminChat = getNotifyTargetChatId(order.businessId);
  if (adminChat == null) return;

  const adminLine = `📱 Заказ ${label} → ${order.status}\n(обновлено в Mini App)`;
  const adminUrl = await buildMerchantAdminOrdersWebAppUrl(order.businessId);
  const replyMarkup = adminMiniAppNotifyKeyboard(adminUrl);
  const tBot = getBotForOwner(order.businessId) ?? bot;
  if (tBot) {
    try {
      await tBot.telegram.sendMessage(adminChat, adminLine, {
        reply_markup: replyMarkup,
      });
    } catch (e) {
      console.error("notify admin (bot):", e);
    }
  } else {
    await sendTelegramText(adminChat, adminLine, order.businessId);
  }
}

/** Уведомление мерчанту о новом заказе (после успешной оплаты Finik). */
export async function notifyMerchantOnNewPaidOrder(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { quantity: true } } },
  });
  if (order == null) return;

  const displayName = order.name?.trim() || "Гость";
  const phone = order.phone?.trim() || "—";
  const itemCount = order.items.reduce(
    (sum, i) => sum + Math.max(0, Number(i.quantity ?? 0)),
    0,
  );

  void createMerchantNotification({
    businessId: order.businessId,
    kind: "ORDER_NEW",
    title: `Новый заказ ${orderDisplayLabel(order)}`,
    body: `${displayName} · ${order.total} сом`,
    href: "#/admin/orders",
  });

  const chatId = getNotifyTargetChatId(order.businessId);
  if (chatId == null) return;

  const displayNum =
    order.orderNumber?.trim() ||
    orderDisplayLabel({ id: order.id, orderNumber: null });
  const message = formatNewOrderTelegramMessage({
    orderNumber: displayNum,
    customerName: displayName,
    phone,
    total: order.total,
    itemCount: itemCount > 0 ? itemCount : 1,
  });

  const adminUrl = await buildMerchantAdminOrdersWebAppUrl(order.businessId);
  const replyMarkup = adminMiniAppNotifyKeyboard(adminUrl);
  const tBot = getBotForOwner(order.businessId) ?? bot;
  if (tBot) {
    try {
      await tBot.telegram.sendMessage(chatId, message, {
        reply_markup: replyMarkup,
      });
    } catch (e) {
      console.error("notifyMerchantOnNewPaidOrder (bot):", e);
    }
    return;
  }
  await sendTelegramText(chatId, message, order.businessId);
}
