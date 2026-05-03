import { SubscriptionStatus, type Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type DbClient = Prisma.TransactionClient | typeof prisma;
import {
  initDynamicStoreBot,
  stopDynamicStoreBotInMemory,
} from "../bot/dynamicBots.js";
import { shouldDeactivateStoreForSubscription } from "./subscriptionMaintenance.js";
import { notifyPlatformAdminsNewPaymentRequest } from "./saasBillingNotify.js";

export const SAAS_SUBSCRIPTION_PRICE_20_D = 1500;
export const SAAS_SUBSCRIPTION_PRICE_30_D = 5500;

/** 90-дневный план как 3×30 (синхронизация с автоматическими платежами Finik). */
export const SAAS_SUBSCRIPTION_PRICE_90_D = SAAS_SUBSCRIPTION_PRICE_30_D * 3;

export const SUBSCRIPTION_EXPIRED_USER_MESSAGE =
  "❌ Subscription expired. Use /pay";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Если срок триала и оплаты вышел — ставим isActive=false (кроме ручного блока).
 */
export async function syncBusinessSubscriptionActivationState(
  businessId: number,
  now = new Date(),
): Promise<void> {
  const b = await prisma.business.findUnique({ where: { id: businessId } });
  if (b == null || b.isBlocked) return;

  if (!shouldDeactivateStoreForSubscription(b, now)) return;

  if (!b.isActive) return;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      isActive: false,
      subscriptionStatus: SubscriptionStatus.EXPIRED,
      lastReminder3DaysAt: null,
      lastReminder1DayAt: null,
    },
  });
}

export async function adminBlockBusiness(businessId: number): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { isBlocked: true, isActive: false },
  });
  await stopDynamicStoreBotInMemory(businessId);
}

export async function adminUnblockBusiness(businessId: number): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { isBlocked: false, isActive: true },
  });
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, botToken: true },
  });
  const tok = String(b?.botToken ?? "").trim();
  if (b != null && tok) {
    try {
      await initDynamicStoreBot({ businessId: b.id, botToken: tok });
    } catch (e) {
      console.error("[saasBillingService] unblock re-init bot failed:", b.id, e);
    }
  }
}

export async function adminApproveSaasPayment(
  paymentRequestId: number,
  forcedAmountSom?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: {
      business: {
        select: {
          id: true,
          botToken: true,
          subscriptionEndsAt: true,
        },
      },
    },
  });
  if (pr == null) {
    return { ok: false, error: "Заявка не найдена" };
  }
  if (pr.status !== "pending") {
    return { ok: false, error: "Заявка уже обработана" };
  }

  const amount = forcedAmountSom ?? pr.amountSom ?? null;
  if (amount !== SAAS_SUBSCRIPTION_PRICE_20_D && amount !== SAAS_SUBSCRIPTION_PRICE_30_D) {
    return {
      ok: false,
      error: `Нужна сумма ${SAAS_SUBSCRIPTION_PRICE_20_D} или ${SAAS_SUBSCRIPTION_PRICE_30_D} сом (в заявке или вторым аргументом команды)`,
    };
  }

  const days = amount === SAAS_SUBSCRIPTION_PRICE_20_D ? 20 : 30;
  const now = new Date();
  const currentEnd = pr.business.subscriptionEndsAt;
  const baseStart =
    currentEnd != null && currentEnd.getTime() > now.getTime()
      ? currentEnd
      : now;
  const subscriptionEndsAt = new Date(baseStart.getTime() + days * MS_DAY);

  await prisma.$transaction([
    prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "approved" },
    }),
    prisma.business.update({
      where: { id: pr.businessId },
      data: {
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionEndsAt,
      },
    }),
  ]);

  const tok = String(pr.business.botToken ?? "").trim();
  if (tok) {
    try {
      await initDynamicStoreBot({
        businessId: pr.businessId,
        botToken: tok,
      });
    } catch (e) {
      console.error(
        "[saasBillingService] approve: re-init bot failed:",
        pr.businessId,
        e,
      );
    }
  }

  return { ok: true };
}

/** Дни и сумма для планов SaaS (30 / 90); для ручных заявок по-прежнему 20 / 30 дней. */
export function saasFinikSubscriptionPlanSpec(
  plan: 30 | 90,
): { days: number; amountSom: number } {
  if (plan === 30) return { days: 30, amountSom: SAAS_SUBSCRIPTION_PRICE_30_D };
  return { days: 90, amountSom: SAAS_SUBSCRIPTION_PRICE_90_D };
}

/**
 * Продление подписки на N дней после успешной оплаты Finik.
 * При `isBlocked` дата продлевается, витрину не включаем (`isActive` остаётся false).
 */
export async function extendBusinessSubscriptionAfterFinikPayment(
  businessId: number,
  days: number,
  now = new Date(),
  tx?: DbClient,
): Promise<{ botToken: string | null; shouldHydrateBot: boolean } | null> {
  const db = tx ?? prisma;
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionEndsAt: true,
      isBlocked: true,
      botToken: true,
    },
  });
  if (b == null) return null;

  const currentEnd = b.subscriptionEndsAt;
  const baseStart =
    currentEnd != null && currentEnd.getTime() > now.getTime()
      ? currentEnd
      : now;
  const subscriptionEndsAt = new Date(baseStart.getTime() + days * MS_DAY);

  const isActive = !b.isBlocked;

  await db.business.update({
    where: { id: businessId },
    data: {
      subscriptionEndsAt,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive,
      lastReminder3DaysAt: null,
      lastReminder1DayAt: null,
    },
  });

  return {
    botToken: b.botToken,
    shouldHydrateBot: isActive,
  };
}

export async function adminRejectSaasPayment(
  paymentRequestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
  });
  if (pr == null) return { ok: false, error: "Заявка не найдена" };
  if (pr.status !== "pending") {
    return { ok: false, error: "Заявка уже обработана" };
  }
  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { status: "rejected" },
  });
  return { ok: true };
}

function parseAmountFromCaption(caption: string | undefined): number | null {
  if (caption == null || caption.trim() === "") return null;
  const m = caption.match(/\b(1500|5500)\b/);
  if (!m) return null;
  return Number(m[1]);
}

export async function createSaasPaymentRequestFromMerchantPhoto(input: {
  businessId: number;
  botToken: string;
  largestFileId: string;
  caption?: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const res = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(input.botToken)}/getFile?file_id=${encodeURIComponent(input.largestFileId)}`,
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { file_path?: string };
  };
  if (!res.ok || !json.ok || !json.result?.file_path) {
    return { ok: false, error: "Не удалось получить файл чека из Telegram" };
  }
  const photoUrl =
    `https://api.telegram.org/file/bot${input.botToken}/${json.result.file_path}`;

  const amountSom = parseAmountFromCaption(input.caption);

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, name: true },
  });
  if (b == null) return { ok: false, error: "Магазин не найден" };

  const row = await prisma.paymentRequest.create({
    data: {
      businessId: input.businessId,
      photoUrl,
      status: "pending",
      ...(amountSom != null ? { amountSom } : {}),
    },
  });

  await notifyPlatformAdminsNewPaymentRequest({
    businessId: b.id,
    businessName: b.name,
    paymentRequestId: row.id,
  });

  return { ok: true, id: row.id };
}

export async function sendSubscriptionExpiredChatMessage(input: {
  botToken: string;
  chatId: number;
}): Promise<void> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(input.botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: SUBSCRIPTION_EXPIRED_USER_MESSAGE,
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error(
        "[saasBillingService] sendSubscriptionExpired failed",
        input.chatId,
        res.status,
        json,
      );
    }
  } catch (e) {
    console.error("[saasBillingService] sendSubscriptionExpired", e);
  }
}
