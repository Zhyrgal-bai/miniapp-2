import { SubscriptionStatus } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  createFinikPlatformSubscriptionSession,
  verifyFinikWebhookSignature,
} from "./finikMerchant.js";
import {
  extendBusinessSubscriptionAfterFinikPayment,
  saasFinikSubscriptionPlanSpec,
} from "./saasBillingService.js";
import {
  hasValidPaidOrTrialWindow,
  type SubscriptionGateFields,
} from "./subscriptionAccess.js";
import { platformMerchantIsStoreOwner } from "./platformMerchantAccess.js";
import {
  getPlatformFinikCredentials,
  isPlatformFinikReady,
} from "../shared/platformFinik.js";
import {
  SAAS_SUBSCRIPTION_PLANS,
  type SaasSubscriptionPlanDays,
} from "../shared/saasSubscriptionPricing.js";

export type MerchantSubscriptionUiStatus = "ACTIVE" | "TRIAL" | "EXPIRED";

export type MerchantSubscriptionPanelPayload = {
  businessId: number;
  displayStatus: MerchantSubscriptionUiStatus;
  displayStatusLabel: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  storeOpenForCustomers: boolean;
  isBlocked: boolean;
  isActive: boolean;
  platformFinikReady: boolean;
  canPay: boolean;
  isOwner: boolean;
  plans: typeof SAAS_SUBSCRIPTION_PLANS;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function calendarDaysAhead(end: Date, now: Date): number | null {
  const utcLater = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  const utcEarlier = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = Math.round((utcLater - utcEarlier) / MS_DAY);
  return d;
}

export function resolveMerchantSubscriptionUiStatus(
  b: SubscriptionGateFields,
  now = new Date(),
): MerchantSubscriptionUiStatus {
  if (b.isBlocked) {
    return "EXPIRED";
  }
  const t = now.getTime();
  const trialOk =
    b.subscriptionStatus === SubscriptionStatus.TRIALING &&
    b.trialEndsAt != null &&
    b.trialEndsAt.getTime() >= t &&
    (b.subscriptionEndsAt == null || b.subscriptionEndsAt.getTime() >= t);
  if (trialOk) {
    return "TRIAL";
  }
  const paidOk =
    b.subscriptionStatus === SubscriptionStatus.ACTIVE &&
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() >= t;
  if (paidOk) {
    return "ACTIVE";
  }
  if (hasValidPaidOrTrialWindow(b, now)) {
    return b.subscriptionStatus === SubscriptionStatus.TRIALING
      ? "TRIAL"
      : "ACTIVE";
  }
  return "EXPIRED";
}

const STATUS_LABEL: Record<MerchantSubscriptionUiStatus, string> = {
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  EXPIRED: "EXPIRED",
};

function primaryEndIso(b: {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
}): string | null {
  if (b.subscriptionStatus === SubscriptionStatus.TRIALING && b.trialEndsAt) {
    return b.trialEndsAt.toISOString();
  }
  return b.subscriptionEndsAt?.toISOString() ?? null;
}

export async function buildMerchantSubscriptionPanel(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | { ok: true; panel: MerchantSubscriptionPanelPayload }
  | { ok: false; statusCode: number; error: string }
> {
  if (!Number.isInteger(input.businessId) || input.businessId <= 0) {
    return { ok: false, statusCode: 400, error: "Некорректный businessId" };
  }

  const isOwner = await platformMerchantIsStoreOwner(
    input.telegramId,
    input.businessId,
  );
  const staff = await prisma.businessStaff.findFirst({
    where: {
      businessId: input.businessId,
      user: { telegramId: input.telegramId.trim() },
    },
    select: { id: true },
  });
  if (!isOwner && staff == null) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (b == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const now = new Date();
  const displayStatus = resolveMerchantSubscriptionUiStatus(b, now);
  const endIso = primaryEndIso(b);
  let daysLeft: number | null = null;
  if (endIso != null) {
    const end = new Date(endIso);
    if (!Number.isNaN(end.getTime())) {
      daysLeft = calendarDaysAhead(end, now);
    }
  }

  const entitled = hasValidPaidOrTrialWindow(b, now);
  const storeOpenForCustomers =
    !b.isBlocked && b.isActive && entitled;

  return {
    ok: true,
    panel: {
      businessId: b.id,
      displayStatus,
      displayStatusLabel: STATUS_LABEL[displayStatus],
      subscriptionStatus: String(b.subscriptionStatus),
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: b.subscriptionEndsAt?.toISOString() ?? null,
      daysLeft,
      storeOpenForCustomers,
      isBlocked: b.isBlocked,
      isActive: b.isActive,
      platformFinikReady: isPlatformFinikReady(),
      canPay: isOwner && isPlatformFinikReady() && !b.isBlocked,
      isOwner,
      plans: SAAS_SUBSCRIPTION_PLANS,
    },
  };
}

export type CreatePlatformSubscriptionPaymentResult =
  | {
      ok: true;
      paymentUrl: string;
      subscriptionPaymentId: number;
      planDays: SaasSubscriptionPlanDays;
      amountSom: number;
    }
  | { ok: false; statusCode: number; error: string };

export async function createPlatformSubscriptionPaymentSession(input: {
  telegramId: string;
  businessId: number;
  plan: SaasSubscriptionPlanDays;
}): Promise<CreatePlatformSubscriptionPaymentResult> {
  const { telegramId, businessId, plan } = input;
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, error: "Нужен корректный businessId" };
  }

  const isOwner = await platformMerchantIsStoreOwner(telegramId, businessId);
  if (!isOwner) {
    return {
      ok: false,
      statusCode: 403,
      error: "Оплатить подписку может только владелец магазина",
    };
  }

  if (!isPlatformFinikReady()) {
    return {
      ok: false,
      statusCode: 503,
      error:
        "Онлайн-оплата временно недоступна. Обратитесь в поддержку платформы.",
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, isBlocked: true },
  });
  if (business == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }
  if (business.isBlocked) {
    return {
      ok: false,
      statusCode: 403,
      error: "Магазин заблокирован оператором платформы",
    };
  }

  const spec = saasFinikSubscriptionPlanSpec(plan);

  const row = await prisma.subscriptionFinikPayment.create({
    data: {
      businessId,
      planDays: spec.days,
      amountSom: spec.amountSom,
      payerTelegramId: telegramId,
      status: "pending",
    },
  });

  const finik = await createFinikPlatformSubscriptionSession({
    subscriptionPaymentRowId: row.id,
    amountSom: spec.amountSom,
  });

  if (!finik.ok) {
    await prisma.subscriptionFinikPayment.update({
      where: { id: row.id },
      data: { status: "failed" },
    });
    return { ok: false, statusCode: 502, error: finik.error };
  }

  await prisma.subscriptionFinikPayment.update({
    where: { id: row.id },
    data: { finikPaymentId: finik.paymentId },
  });

  return {
    ok: true,
    paymentUrl: finik.paymentUrl,
    subscriptionPaymentId: row.id,
    planDays: spec.days as SaasSubscriptionPlanDays,
    amountSom: spec.amountSom,
  };
}

export async function applyPlatformSubscriptionFinikWebhook(
  req: import("express").Request,
  rawBody: string,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; duplicate?: boolean; ignored?: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  const platformSecret = getPlatformFinikCredentials()?.secret ?? null;
  if (!verifyFinikWebhookSignature(platformSecret, req, rawBody)) {
    return { ok: false, statusCode: 403, error: "Invalid signature" };
  }

  const paymentId = extractPaymentIdFromBody(body);
  let subRow =
    paymentId !== ""
      ? await prisma.subscriptionFinikPayment.findFirst({
          where: { finikPaymentId: paymentId },
        })
      : null;

  if (subRow == null) {
    const sid = parseSaasSubRowId(body);
    if (sid != null) {
      subRow = await prisma.subscriptionFinikPayment.findUnique({
        where: { id: sid },
      });
    }
  }

  if (subRow == null) {
    return { ok: false, statusCode: 404, error: "Subscription payment not found" };
  }

  const business = await prisma.business.findUnique({
    where: { id: subRow.businessId },
    select: { id: true, botToken: true },
  });
  if (business == null) {
    return { ok: false, statusCode: 404, error: "Business not found" };
  }

  if (paymentId !== "" && subRow.finikPaymentId == null) {
    await prisma.subscriptionFinikPayment.update({
      where: { id: subRow.id },
      data: { finikPaymentId: paymentId },
    });
  }

  const statusRaw = body.status ?? body.payment_status ?? body.state;
  const status = String(statusRaw ?? "").toLowerCase();
  const successStatuses = new Set([
    "success",
    "paid",
    "completed",
    "succeeded",
  ]);

  if (!successStatuses.has(status)) {
    return { ok: true, ignored: true };
  }

  if (subRow.status === "completed") {
    return { ok: true, duplicate: true };
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionFinikPayment.updateMany({
      where: { id: subRow!.id, status: "pending" },
      data: { status: "completed" },
    });
    if (claimed.count !== 1) {
      return { kind: "duplicate" as const };
    }

    const ext = await extendBusinessSubscriptionAfterFinikPayment(
      subRow!.businessId,
      subRow!.planDays,
      new Date(),
      tx,
    );
    return { kind: "applied" as const, ext };
  });

  if (outcome.kind === "duplicate") {
    return { ok: true, duplicate: true };
  }

  const ext = outcome.ext;
  if (
    ext?.shouldHydrateBot &&
    ext.botToken != null &&
    String(ext.botToken).trim() !== ""
  ) {
    const { initDynamicStoreBot } = await import("../bot/dynamicBots.js");
    try {
      await initDynamicStoreBot({
        businessId: subRow.businessId,
        botToken: String(ext.botToken).trim(),
      });
    } catch (e) {
      console.error(
        "platform subscription webhook: hydrate bot failed",
        subRow.businessId,
        e,
      );
    }
  }

  const tok = plainBotTokenFromStored(business.botToken);
  if (tok) {
    void sendOwnerPaymentSuccessNotice(tok, subRow.payerTelegramId);
  }

  return { ok: true };
}

function extractPaymentIdFromBody(body: Record<string, unknown>): string {
  const paymentIdRaw =
    body.paymentId ??
    body.payment_id ??
    body.id ??
    body.orderId ??
    body.order_id;
  return paymentIdRaw != null && String(paymentIdRaw).trim() !== ""
    ? String(paymentIdRaw).trim()
    : "";
}

function parseSaasSubRowId(body: Record<string, unknown>): number | null {
  const candidates: unknown[] = [
    body.external_id,
    body.externalId,
    body.order_id,
    body.orderId,
  ];
  const meta =
    typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : null;
  if (meta != null) {
    candidates.push(meta.external_id, meta.externalId);
  }
  const prefix = "saas_sub:";
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const s = c.trim();
    if (s.startsWith(prefix)) {
      const n = Number(s.slice(prefix.length));
      if (Number.isInteger(n) && n > 0) return n;
    }
  }
  return null;
}

async function sendOwnerPaymentSuccessNotice(
  botToken: string,
  telegramUserId: string,
): Promise<void> {
  const chatId = Number(telegramUserId);
  if (!Number.isFinite(chatId) || chatId <= 0) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Оплата подписки прошла успешно. Магазин снова открыт для покупателей.",
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error(
        "platformSubscriptionFinik sendMessage failed",
        chatId,
        res.status,
        json,
      );
    }
  } catch (e) {
    console.error("platformSubscriptionFinik sendMessage", e);
  }
}
