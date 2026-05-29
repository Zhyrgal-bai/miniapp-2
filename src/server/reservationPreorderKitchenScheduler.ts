import { prisma } from "./db.js";
import { getBotForOwner, getBotTokenForOwner, bot, getNotifyTargetChatId } from "../bot/bot.js";
import { findBusinessOwnerTelegramId } from "./tableReservationStaff.js";
import { publishVenueUpdate } from "./venueRealtime.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";

/** Default prep time when product has no preparationMinutes. */
export const DEFAULT_PRODUCT_PREP_MINUTES = 10;

export function computeKitchenPrepAt(
  reservedAt: Date,
  maxPrepMinutes: number,
  now = new Date(),
): Date {
  const prepMs = Math.max(1, Math.round(maxPrepMinutes)) * 60_000;
  const at = new Date(reservedAt.getTime() - prepMs);
  return at.getTime() < now.getTime() ? now : at;
}

export async function computeOrderMaxPrepMinutes(orderId: number): Promise<number> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true },
  });
  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is number => id != null && id > 0);
  if (productIds.length === 0) return DEFAULT_PRODUCT_PREP_MINUTES;

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { preparationMinutes: true },
  });

  let max = DEFAULT_PRODUCT_PREP_MINUTES;
  for (const p of products) {
    const m =
      p.preparationMinutes != null && Number.isFinite(p.preparationMinutes)
        ? Math.max(1, Math.round(p.preparationMinutes))
        : DEFAULT_PRODUCT_PREP_MINUTES;
    if (m > max) max = m;
  }
  return max;
}

async function resolveOwnerChatId(businessId: number): Promise<string | number | null> {
  const ownerTg = await findBusinessOwnerTelegramId(businessId);
  if (ownerTg) return ownerTg;
  return getNotifyTargetChatId(businessId) ?? null;
}

async function sendKitchenTelegram(
  businessId: number,
  chatId: string | number,
  text: string,
): Promise<void> {
  const tBot = getBotForOwner(businessId) ?? bot;
  if (tBot) {
    try {
      await tBot.telegram.sendMessage(chatId, text);
      return;
    } catch (e) {
      console.error("kitchenPreorderNotify bot send:", e);
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
    console.error("kitchenPreorderNotify sendMessage:", e);
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export async function notifyKitchenReservationPreorderReady(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      businessId: true,
      reservation: {
        select: {
          id: true,
          reservedAt: true,
          table: { select: { name: true } },
        },
      },
    },
  });
  if (!order?.reservation) return;

  const chatId = await resolveOwnerChatId(order.businessId);
  const tableLabel = order.reservation.table.name;
  const text =
    `🔥 Новый предзаказ\n\n` +
    `${tableLabel}\n\n` +
    `Время брони:\n${formatTime(order.reservation.reservedAt)}\n\n` +
    `Начать приготовление.`;

  if (chatId != null) {
    void sendKitchenTelegram(order.businessId, chatId, text);
  }

  void createMerchantNotification({
    businessId: order.businessId,
    kind: "ORDER_NEW",
    title: "🔥 Новый предзаказ",
    body: `${tableLabel} · бронь ${formatTime(order.reservation.reservedAt)}`,
    href: "#/admin/kitchen",
  });
  publishVenueUpdate(order.businessId, "kitchen");
}

/** After Finik paid: schedule kitchen prep for reservation preorder. */
export async function scheduleReservationPreorderAfterPayment(
  orderId: number,
  now = new Date(),
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      businessId: true,
      reservationId: true,
      reservation: { select: { reservedAt: true } },
    },
  });
  if (!order?.reservationId || !order.reservation) return;

  const maxPrepMinutes = await computeOrderMaxPrepMinutes(orderId);
  const kitchenPrepAt = computeKitchenPrepAt(
    order.reservation.reservedAt,
    maxPrepMinutes,
    now,
  );
  const startNow = kitchenPrepAt.getTime() <= now.getTime();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      preorderStatus: "PREORDER_PAID",
      prepStatus: startNow ? "READY_FOR_PREP" : "SCHEDULED",
      kitchenPrepAt,
      preparationMinutes: maxPrepMinutes,
    },
  });

  if (startNow) {
    await notifyKitchenReservationPreorderReady(orderId);
  } else {
    void createMerchantNotification({
      businessId: order.businessId,
      kind: "ORDER_NEW",
      title: `Предзаказ запланирован`,
      body: `Готовка с ${formatTime(kitchenPrepAt)} · бронь ${formatTime(order.reservation.reservedAt)}`,
      href: "#/admin/kitchen",
    });
  }
}

export async function runReservationPreorderKitchenSchedulerOnce(
  now = new Date(),
): Promise<number> {
  const due = await prisma.order.findMany({
    where: {
      reservationId: { not: null },
      preorderStatus: "PREORDER_PAID",
      prepStatus: "SCHEDULED",
      kitchenPrepAt: { lte: now },
      status: { notIn: ["CANCELLED"] },
    },
    select: { id: true, businessId: true },
    take: 100,
  });

  for (const row of due) {
    await prisma.order.update({
      where: { id: row.id },
      data: { prepStatus: "READY_FOR_PREP" },
    });
    await notifyKitchenReservationPreorderReady(row.id);
  }

  return due.length;
}

export function formatMinutesUntil(iso: string, now = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "сейчас";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `через ${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `через ${h} ч ${m} мин` : `через ${h} ч`;
}
