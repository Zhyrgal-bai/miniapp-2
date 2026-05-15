import { MembershipRole, SubscriptionStatus } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import { merchantStoreEntitled } from "./subscriptionAccess.js";
import {
  classifyWebhookOkError,
  fetchTelegramWebhookInfo,
} from "./platformTelegramWebhook.js";

/** Платформа Mini App — только безопасные поля (без botToken). */
export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  /** Публичный permalink витрины (если задан). */
  slug: string | null;
  /** Короткий код статуса для UI */
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  /** Есть действующее окно оплаты/trial и магазин не в ручном бане. */
  subscriptionActive: boolean;
  /** ISO 8601, если задано на сервере. */
  subscriptionEndsAt: string | null;
  /** ISO 8601 для trial. */
  trialEndsAt: string | null;
  /** OK при валидном вебхуке по ответу getWebhookInfo; ERROR иначе. */
  webhookStatus: "OK" | "ERROR";
  /** URL из getWebhookInfo (без токена); null если не настроен или ошибка API. */
  webhookUrl: string | null;
};

/** Внутренний select + botToken только для проб getWebhookInfo, не попадает в DTO. */
const businessSelectForPlatformList = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  isBlocked: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  botToken: true,
} as const;

export function computePlatformBusinessStatus(b: {
  isBlocked: boolean;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: Date | null;
}): string {
  if (b.isBlocked) return "blocked";
  if (!b.isActive) return "inactive";
  const end = b.subscriptionEndsAt?.getTime();
  if (end != null && end < Date.now()) return "subscription_expired";
  switch (b.subscriptionStatus) {
    case SubscriptionStatus.ACTIVE:
      return "active";
    case SubscriptionStatus.TRIALING:
      return "trialing";
    case SubscriptionStatus.PAST_DUE:
      return "past_due";
    case SubscriptionStatus.CANCELED:
      return "canceled";
    case SubscriptionStatus.EXPIRED:
      return "expired";
    default:
      return String(b.subscriptionStatus).toLowerCase();
  }
}

export async function mapRowsWithWebhook(
  rows: Array<{
    id: number;
    name: string;
    slug: string | null;
    isActive: boolean;
    isBlocked: boolean;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    botToken: string | null;
  }>,
): Promise<PlatformMyBusinessDTO[]> {
  const limit = Math.min(rows.length || 1, 8);
  const now = new Date();

  /** Ограниченная параллельность, чтобы не забивать Telegram при большом списке. */
  async function probeAt(i: number): Promise<PlatformMyBusinessDTO> {
    const r = rows[i]!;
    const info = await fetchTelegramWebhookInfo(
      plainBotTokenFromStored(r.botToken),
    );
    const webhookStatus = classifyWebhookOkError(info);
    const subscriptionActive = merchantStoreEntitled(r, now);
    return {
      id: r.id,
      name: r.name,
      slug: typeof r.slug === "string" && r.slug.trim() !== "" ? r.slug.trim() : null,
      status: computePlatformBusinessStatus(r),
      isActive: r.isActive,
      isBlocked: r.isBlocked,
      subscriptionActive,
      subscriptionEndsAt: r.subscriptionEndsAt?.toISOString() ?? null,
      trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
      webhookStatus,
      webhookUrl: info.webhookUrl,
    };
  }

  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = next++;
      if (idx >= rows.length) return;
      out[idx] = await probeAt(idx);
    }
  }

  const out: PlatformMyBusinessDTO[] = new Array(rows.length);
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

async function listMemberBusinessesSafe(
  telegramId: string,
): Promise<PlatformMyBusinessDTO[]> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!user) return [];

  const rows = await prisma.business.findMany({
    where: {
      memberships: {
        some: {
          userId: user.id,
          role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
        },
      },
    },
    select: businessSelectForPlatformList,
    orderBy: { id: "asc" },
  });
  return mapRowsWithWebhook(rows);
}

/**
 * Мини-платформа `/merchant` (клиент): только магазины, где пользователь — OWNER или ADMIN магазина.
 * Глобальные ADMIN_IDS не расширяют список (админка — отдельно: бот + `/platform-admin`).
 */
export async function listPlatformOwnerBusinesses(
  telegramId: string,
): Promise<PlatformMyBusinessDTO[]> {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return [];

  return listMemberBusinessesSafe(tid);
}
