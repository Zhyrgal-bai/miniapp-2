import type { RefundRequestStatus } from "@prisma/client";
import { createMerchantNotification } from "../merchantNotificationsService.js";
import { orderDisplayLabel } from "../../shared/orderDisplay.js";
import { getBotForOwner, bot } from "../../bot/bot.js";
import { prisma } from "../db.js";

async function sendCustomerTelegram(
  businessId: number,
  telegramId: string,
  text: string,
): Promise<void> {
  const tgId = Number(telegramId);
  if (!Number.isFinite(tgId) || tgId <= 0) return;
  const tBot = getBotForOwner(businessId) ?? bot;
  try {
    if (tBot) {
      await tBot.telegram.sendMessage(tgId, text);
    }
  } catch (e) {
    console.error("[refundNotify] customer telegram:", e);
  }
}

export async function notifyCustomerRefundStatus(input: {
  businessId: number;
  userId: number;
  orderId: number;
  orderNumber?: string | null;
  status: RefundRequestStatus;
  refundAmount?: number | null;
  orderTotal: number;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { telegramId: true },
  });
  if (!user?.telegramId) return;

  const label = orderDisplayLabel({
    id: input.orderId,
    orderNumber: input.orderNumber ?? null,
  });

  const amount = input.refundAmount ?? input.orderTotal;
  const messages: Partial<Record<RefundRequestStatus, string>> = {
    REQUESTED: `📩 Заявка на возврат по заказу ${label} отправлена. Магазин рассмотрит её в ближайшее время.`,
    REVIEWING: `🔍 Заявка на возврат по заказу ${label} принята на проверку.`,
    APPROVED: `✅ Возврат по заказу ${label} одобрен. Ожидайте зачисления ${amount} сом.`,
    REJECTED: `❌ Заявка на возврат по заказу ${label} отклонена.`,
    REFUNDED: `💸 Возврат ${amount} сом по заказу ${label} выполнен.`,
  };
  const text = messages[input.status];
  if (!text) return;
  void sendCustomerTelegram(input.businessId, user.telegramId, text);
}

export async function notifyMerchantRefundEvent(input: {
  businessId: number;
  orderId: number;
  orderNumber?: string | null;
  kind: "created" | "completed" | "customer_requested";
  refundAmount?: number | null;
  initiatedByMerchant?: boolean;
}): Promise<void> {
  const label = orderDisplayLabel({
    id: input.orderId,
    orderNumber: input.orderNumber ?? null,
  });

  if (input.kind === "customer_requested") {
    void createMerchantNotification({
      businessId: input.businessId,
      kind: "REFUND_REQUEST",
      title: "Заявка на возврат денег",
      body: label,
      href: "/admin/support?tab=refunds",
    });
    return;
  }

  if (input.kind === "created") {
    void createMerchantNotification({
      businessId: input.businessId,
      kind: "REFUND_REQUEST",
      title: input.initiatedByMerchant
        ? "Возврат инициирован магазином"
        : "Новая заявка на возврат",
      body: label,
      href: "/admin/support?tab=refunds",
    });
    return;
  }

  void createMerchantNotification({
    businessId: input.businessId,
    kind: "REFUND_REQUEST",
    title: "Возврат выполнен",
    body:
      input.refundAmount != null
        ? `${label} · ${input.refundAmount} сом`
        : label,
    href: "/admin/support?tab=refunds",
  });
}
