import type { Prisma } from "@prisma/client";
import { MerchantNotificationKind, StorefrontEventType } from "@prisma/client";
import { prisma } from "./db.js";

const ALLOWED_EVENTS = new Set<string>([
  "STORE_VIEW",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_START",
]);

export type IngestStorefrontEvent = {
  eventType: string;
  visitorKey: string;
  userId?: number | null;
  productId?: number | null;
  meta?: Record<string, unknown>;
};

export async function ingestStorefrontEvents(input: {
  businessId: number;
  events: IngestStorefrontEvent[];
}): Promise<number> {
  const bid = input.businessId;
  if (!Number.isInteger(bid) || bid <= 0) return 0;

  const rows: Prisma.StorefrontEventCreateManyInput[] = [];
  for (const ev of input.events.slice(0, 32)) {
    const type = String(ev.eventType ?? "").trim().toUpperCase();
    if (!ALLOWED_EVENTS.has(type)) continue;
    const vk = String(ev.visitorKey ?? "").trim().slice(0, 128);
    if (vk.length < 4) continue;
    const uid =
      ev.userId != null && Number.isInteger(ev.userId) && ev.userId > 0
        ? ev.userId
        : null;
    const pid =
      ev.productId != null && Number.isInteger(ev.productId) && ev.productId > 0
        ? ev.productId
        : null;
    rows.push({
      businessId: bid,
      eventType: type as StorefrontEventType,
      visitorKey: vk,
      userId: uid,
      productId: pid,
      meta: (ev.meta ?? {}) as Prisma.InputJsonValue,
    });
  }

  if (rows.length === 0) return 0;
  const r = await prisma.storefrontEvent.createMany({ data: rows });
  return r.count;
}

export async function createMerchantNotification(input: {
  businessId: number;
  kind: MerchantNotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
}): Promise<void> {
  const bid = input.businessId;
  if (!Number.isInteger(bid) || bid <= 0) return;
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (title === "") return;
  try {
    await prisma.merchantNotification.create({
      data: {
        businessId: bid,
        kind: input.kind,
        title,
        body: input.body?.trim().slice(0, 500) ?? null,
        href: input.href?.trim().slice(0, 256) ?? null,
      },
    });
  } catch (e) {
    console.error("[createMerchantNotification]", e);
  }
}

export async function listMerchantNotifications(input: {
  businessId: number;
  limit?: number;
}): Promise<{
  unreadCount: number;
  items: Array<{
    id: number;
    kind: string;
    title: string;
    body: string | null;
    href: string | null;
    readAt: string | null;
    createdAt: string;
  }>;
}> {
  const bid = input.businessId;
  const take = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const [unreadCount, rows] = await Promise.all([
    prisma.merchantNotification.count({
      where: { businessId: bid, readAt: null },
    }),
    prisma.merchantNotification.findMany({
      where: { businessId: bid },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);
  return {
    unreadCount,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function markMerchantNotificationsRead(input: {
  businessId: number;
  notificationId?: number;
}): Promise<void> {
  const now = new Date();
  if (input.notificationId != null) {
    await prisma.merchantNotification.updateMany({
      where: {
        businessId: input.businessId,
        id: input.notificationId,
        readAt: null,
      },
      data: { readAt: now },
    });
    return;
  }
  await prisma.merchantNotification.updateMany({
    where: { businessId: input.businessId, readAt: null },
    data: { readAt: now },
  });
}
