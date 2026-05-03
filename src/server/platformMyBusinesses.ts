import { MembershipRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { isAdmin } from "./adminAuth.js";
import {
  classifyWebhookOkError,
  fetchTelegramWebhookInfo,
} from "./platformTelegramWebhook.js";

/** Платформа Mini App — только безопасные поля (без botToken). */
export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  /** Короткий код статуса для UI */
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  /** OK при валидном вебхуке по ответу getWebhookInfo; ERROR иначе. */
  webhookStatus: "OK" | "ERROR";
};

/** Внутренний select + botToken только для проб getWebhookInfo, не попадает в DTO. */
const businessSelectForPlatformList = {
  id: true,
  name: true,
  isActive: true,
  isBlocked: true,
  subscriptionStatus: true,
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

async function mapRowsWithWebhook(
  rows: Array<{
    id: number;
    name: string;
    isActive: boolean;
    isBlocked: boolean;
    subscriptionStatus: SubscriptionStatus;
    subscriptionEndsAt: Date | null;
    botToken: string | null;
  }>,
): Promise<PlatformMyBusinessDTO[]> {
  const limit = Math.min(rows.length || 1, 8);

  /** Ограниченная параллельность, чтобы не забивать Telegram при большом списке. */
  async function probeAt(i: number): Promise<PlatformMyBusinessDTO> {
    const r = rows[i]!;
    const info = await fetchTelegramWebhookInfo(String(r.botToken ?? ""));
    const webhookStatus = classifyWebhookOkError(info);
    return {
      id: r.id,
      name: r.name,
      status: computePlatformBusinessStatus(r),
      isActive: r.isActive,
      isBlocked: r.isBlocked,
      webhookStatus,
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

async function listAllBusinessesSafe(): Promise<PlatformMyBusinessDTO[]> {
  const rows = await prisma.business.findMany({
    select: businessSelectForPlatformList,
    orderBy: { id: "asc" },
  });
  return mapRowsWithWebhook(rows);
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
 * Мини-платформа `/platform`: ADMIN_IDS видят все Business; иначе — только OWNER/ADMIN.
 * Фильтр только по telegramId с сервера (не доверяем произвольным query без заголовка).
 */
export async function listPlatformOwnerBusinesses(
  telegramId: string,
): Promise<PlatformMyBusinessDTO[]> {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return [];

  if (isAdmin(tid)) {
    return listAllBusinessesSafe();
  }
  return listMemberBusinessesSafe(tid);
}
