import { SubscriptionStatus, type Prisma } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  ARCHA_SUBSCRIPTION_GRACE_DAYS,
  addCalendarDays,
  approximateAccessDays,
  legacyPlanDaysToCode,
  planSpecForCode,
  resolveSubscriptionExtensionBaseStart,
  subscriptionEndAfterPlan,
  type ArchaSubscriptionPlanCode,
} from "../shared/archaSubscriptionPlans.js";
import {
  hasValidPaidOrTrialWindow,
  isInSubscriptionGracePeriod,
  isSubscriptionActive,
} from "./subscriptionAccess.js";
import {
  initDynamicStoreBot,
  stopDynamicStoreBotInMemory,
} from "../bot/dynamicBots.js";
import { notifyPlatformAdminsNewPaymentRequest } from "./saasBillingNotify.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const SAAS_SUBSCRIPTION_PRICE_20_D = 1500;
export const SAAS_SUBSCRIPTION_PRICE_30_D = 5500;

/** @deprecated Используйте HALF_YEAR plan registry. */
export const SAAS_SUBSCRIPTION_PRICE_90_D = SAAS_SUBSCRIPTION_PRICE_30_D * 6;

export const SUBSCRIPTION_EXPIRED_USER_MESSAGE =
  "❌ Подписка ARCHA истекла. Откройте панель магазина и продлите подписку.";

const MS_DAY = 24 * 60 * 60 * 1000;

export type ExtendBusinessSubscriptionSource =
  | "finik"
  | "operator"
  | "auto_renew"
  | "legacy_receipt";

export type ExtendBusinessSubscriptionResult = {
  botToken: string | null;
  shouldHydrateBot: boolean;
  subscriptionEndsAt: Date;
  previousEndsAt: Date | null;
};

export type ExtendBusinessSubscriptionInput = {
  businessId: number;
  /** Тариф с календарными месяцами (Finik, auto-renew). */
  planCode?: ArchaSubscriptionPlanCode | null;
  /** Операторское продление в днях (без тарифа). */
  operatorDaysGranted?: number;
  source: ExtendBusinessSubscriptionSource;
  now?: Date;
  tx?: DbClient;
};

function clearReminderFields() {
  return {
    lastReminder7DaysAt: null,
    lastReminder3DaysAt: null,
    lastReminder1DayAt: null,
    lastReminderAfterExpiryAt: null,
    gracePeriodEndsAt: null,
    lastAutoRenewAttemptAt: null,
  };
}

/**
 * Единая точка продления подписки (Finik, оператор, auto-renew, legacy).
 */
export async function extendBusinessSubscription(
  input: ExtendBusinessSubscriptionInput,
): Promise<ExtendBusinessSubscriptionResult | null> {
  const db = input.tx ?? prisma;
  const now = input.now ?? new Date();

  const b = await db.business.findUnique({
    where: { id: input.businessId },
    select: {
      subscriptionEndsAt: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      isBlocked: true,
      botToken: true,
    },
  });
  if (b == null) return null;

  const previousEndsAt = b.subscriptionEndsAt;
  const baseStart = resolveSubscriptionExtensionBaseStart({
    now,
    subscriptionEndsAt: b.subscriptionEndsAt,
    subscriptionStatus: String(b.subscriptionStatus),
    trialEndsAt: b.trialEndsAt,
  });

  let subscriptionEndsAt: Date;
  if (input.planCode != null) {
    subscriptionEndsAt = subscriptionEndAfterPlan(baseStart, input.planCode);
  } else if (
    input.operatorDaysGranted != null &&
    input.operatorDaysGranted > 0
  ) {
    subscriptionEndsAt = addCalendarDays(
      baseStart,
      Math.round(input.operatorDaysGranted),
    );
  } else {
    return null;
  }

  const isActive = !b.isBlocked;

  await db.business.update({
    where: { id: input.businessId },
    data: {
      subscriptionEndsAt,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive,
      ...(input.planCode != null ? { subscriptionPlanCode: input.planCode } : {}),
      ...clearReminderFields(),
    },
  });

  return {
    botToken: plainBotTokenFromStored(b.botToken),
    shouldHydrateBot: isActive,
    subscriptionEndsAt,
    previousEndsAt,
  };
}

/**
 * Если срок триала и оплаты вышел (включая grace) — ставим isActive=false.
 */
export async function syncBusinessSubscriptionActivationState(
  businessId: number,
  now = new Date(),
): Promise<void> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      gracePeriodEndsAt: true,
    },
  });
  if (b == null || b.isBlocked || !b.isActive) return;

  if (hasValidPaidOrTrialWindow(b, now)) return;
  if (isInSubscriptionGracePeriod(b, now)) return;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      isActive: false,
      subscriptionStatus: SubscriptionStatus.EXPIRED,
      gracePeriodEndsAt: null,
      lastReminder3DaysAt: null,
      lastReminder1DayAt: null,
      lastReminder7DaysAt: null,
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

export async function adminDeactivateBusiness(businessId: number): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { isActive: false },
  });
  await stopDynamicStoreBotInMemory(businessId);
}

export async function adminUnblockBusiness(businessId: number): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { isBlocked: false },
  });
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      botToken: true,
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      gracePeriodEndsAt: true,
    },
  });
  const tok = plainBotTokenFromStored(b?.botToken);
  if (b != null && tok && isSubscriptionActive(b)) {
    try {
      await initDynamicStoreBot({ businessId: b.id, botToken: tok });
    } catch (e) {
      console.error("[saasBillingService] unblock re-init bot failed:", b.id, e);
    }
  }
}

export async function adminEnableNonBlockedBusiness(
  businessId: number,
): Promise<
  { ok: true } | { ok: false; statusCode: number; error: string }
> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isBlocked: true,
      botToken: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      gracePeriodEndsAt: true,
    },
  });
  if (b == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }
  if (b.isBlocked) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Нельзя включить заблокированный магазин. Сначала снимите блокировку.",
    };
  }
  await prisma.business.update({
    where: { id: businessId },
    data: { isActive: true },
  });
  const tok = plainBotTokenFromStored(b.botToken);
  if (tok) {
    try {
      await initDynamicStoreBot({ businessId: b.id, botToken: tok });
    } catch (e) {
      console.error(
        "[saasBillingService] adminEnableNonBlockedBusiness init bot failed:",
        b.id,
        e,
      );
    }
  }
  return { ok: true };
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

  await prisma.$transaction(async (tx) => {
    await tx.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "approved" },
    });
    await extendBusinessSubscription({
      businessId: pr.businessId,
      ...(days === 30
        ? { planCode: "MONTHLY" as const }
        : { operatorDaysGranted: days }),
      source: "legacy_receipt",
      now,
      tx,
    });
  });

  const tok = plainBotTokenFromStored(pr.business.botToken);
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

/** @deprecated Используйте planSpecForCode / parseArchaSubscriptionPlanCode. */
export function saasFinikSubscriptionPlanSpec(
  plan: 30 | 90 | ArchaSubscriptionPlanCode,
): {
  days: number;
  amountSom: number;
  planCode: ArchaSubscriptionPlanCode;
  accessDaysGranted: number;
} {
  const code =
    plan === 30 || plan === 90
      ? legacyPlanDaysToCode(plan)
      : plan;
  const spec = planSpecForCode(code);
  const base = new Date();
  const end = subscriptionEndAfterPlan(base, spec.planCode);
  const accessDaysGranted = approximateAccessDays(base, end);
  return {
    days: accessDaysGranted,
    amountSom: spec.amountSom,
    planCode: spec.planCode,
    accessDaysGranted,
  };
}

/** @deprecated Используйте extendBusinessSubscription. */
export async function extendBusinessSubscriptionAfterFinikPayment(
  businessId: number,
  days: number,
  now = new Date(),
  tx?: DbClient,
): Promise<{ botToken: string | null; shouldHydrateBot: boolean } | null> {
  const out = await extendBusinessSubscription({
    businessId,
    operatorDaysGranted: days,
    source: "finik",
    now,
    ...(tx != null ? { tx } : {}),
  });
  if (out == null) return null;
  return { botToken: out.botToken, shouldHydrateBot: out.shouldHydrateBot };
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

export { ARCHA_SUBSCRIPTION_GRACE_DAYS };
