import { prisma } from "./db.js";

const COOLDOWNS_MS: Record<string, number> = {
  checkout: 30_000,
  support_ticket: 60_000,
  support_message: 5_000,
  cancel_request: 120_000,
  refund_request: 120_000,
  return_request: 120_000,
};

export async function assertActionAllowed(input: {
  businessId: number;
  userId: number;
  actionKey: string;
}): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec: number }> {
  const windowMs = COOLDOWNS_MS[input.actionKey] ?? 30_000;
  const now = new Date();
  const row = await prisma.actionCooldown.findUnique({
    where: {
      businessId_userId_actionKey: {
        businessId: input.businessId,
        userId: input.userId,
        actionKey: input.actionKey,
      },
    },
  });
  if (row) {
    const elapsed = now.getTime() - row.lastAt.getTime();
    if (elapsed < windowMs) {
      const retryAfterSec = Math.ceil((windowMs - elapsed) / 1000);
      return {
        ok: false,
        error: `Подождите ${retryAfterSec} с перед повтором`,
        retryAfterSec,
      };
    }
  }
  await prisma.actionCooldown.upsert({
    where: {
      businessId_userId_actionKey: {
        businessId: input.businessId,
        userId: input.userId,
        actionKey: input.actionKey,
      },
    },
    create: {
      businessId: input.businessId,
      userId: input.userId,
      actionKey: input.actionKey,
      lastAt: now,
    },
    update: { lastAt: now },
  });
  return { ok: true };
}

export async function assertNotDuplicateOrder(input: {
  businessId: number;
  buyerUserId: number;
  total: number;
  fingerprint: string;
  windowMinutes?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const since = new Date(Date.now() - (input.windowMinutes ?? 5) * 60_000);
  const recent = await prisma.order.findMany({
    where: {
      businessId: input.businessId,
      buyerUserId: input.buyerUserId,
      total: input.total,
      createdAt: { gte: since },
      status: { not: "CANCELLED" },
    },
    include: { items: { select: { productId: true, size: true, color: true, quantity: true } } },
    orderBy: { id: "desc" },
    take: 3,
  });
  for (const o of recent) {
    const fp = orderFingerprint(o.items);
    if (fp === input.fingerprint) {
      return {
        ok: false,
        error: "Похожий заказ уже отправлен. Проверьте «Мои заказы».",
      };
    }
  }
  return { ok: true };
}

export function orderFingerprint(
  items: Array<{
    productId: number | null;
    size: string;
    color: string;
    quantity: number;
  }>
): string {
  const parts = items
    .map(
      (i) =>
        `${i.productId ?? 0}:${String(i.size).trim()}:${String(i.color).trim()}:${i.quantity}`
    )
    .sort();
  return parts.join("|");
}

export function buildFingerprintFromCart(
  items: Array<{
    productId: number;
    size: string;
    color: string;
    quantity: number;
  }>
): string {
  return orderFingerprint(items);
}
