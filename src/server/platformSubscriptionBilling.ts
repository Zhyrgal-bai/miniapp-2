import { SubscriptionStatus } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  createFinikPlatformSubscriptionSession,
} from "./finikMerchant.js";
import { verifyFinikWebhookAdmission } from "./finik/finikWebhookVerify.js";
import { extractFinikWebhookPaymentIds } from "./finik/finikWebhookPayload.js";
import {
  extendBusinessSubscription,
  type ExtendBusinessSubscriptionSource,
} from "./saasBillingService.js";
import {
  hasCustomerAccessWindow,
  hasValidPaidOrTrialWindow,
  isInSubscriptionGracePeriod,
  type SubscriptionGateFields,
} from "./subscriptionAccess.js";
import { platformMerchantIsStoreOwner } from "./platformMerchantAccess.js";
import {
  isPlatformFinikOfficialReady,
  isPlatformFinikPayReady,
  isPlatformFinikReady,
  PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR,
} from "../shared/platformFinik.js";
import {
  legacyPlanDaysToCode,
  approximateAccessDays,
  isFirstMonthPlanEligible,
  merchantVisibleSubscriptionPlans,
  parseArchaSubscriptionPlanCode,
  planCodeLabel,
  planSpecForCode,
  resolveSubscriptionExtensionBaseStart,
  subscriptionEndAfterPlan,
  totalPlanMonths,
  type ArchaSubscriptionPlanCode,
} from "../shared/archaSubscriptionPlans.js";

export type MerchantSubscriptionUiStatus =
  | "ACTIVE"
  | "TRIAL"
  | "GRACE"
  | "EXPIRED"
  | "EXPIRING"
  | "PENDING_PAYMENT";

export type MerchantSubscriptionPanelPayload = {
  businessId: number;
  displayStatus: MerchantSubscriptionUiStatus;
  displayStatusLabel: string;
  subscriptionStatus: string;
  subscriptionPlanCode: string | null;
  subscriptionPlanLabel: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  daysLeft: number | null;
  countdownMs: number | null;
  inGracePeriod: boolean;
  autoRenewEnabled: boolean;
  storeOpenForCustomers: boolean;
  isBlocked: boolean;
  isActive: boolean;
  platformFinikReady: boolean;
  platformFinikPayReady: boolean;
  canPay: boolean;
  isOwner: boolean;
  firstMonthEligible: boolean;
  hasPendingPayment: boolean;
  plans: Array<{
    code: ArchaSubscriptionPlanCode;
    title: string;
    subtitle: string;
    paidMonths: number;
    bonusMonths: number;
    bonusDays: number;
    totalMonths: number;
    amountSom: number;
    badge?: string;
    featured?: boolean;
    popular?: boolean;
  }>;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function calendarDaysAhead(end: Date, now: Date): number | null {
  const utcLater = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  const utcEarlier = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((utcLater - utcEarlier) / MS_DAY);
}

export function resolveMerchantSubscriptionUiStatus(
  b: SubscriptionGateFields,
  now = new Date(),
  hasPendingPayment = false,
): MerchantSubscriptionUiStatus {
  if (b.isBlocked) {
    return "EXPIRED";
  }
  if (hasPendingPayment) {
    return "PENDING_PAYMENT";
  }
  if (isInSubscriptionGracePeriod(b, now)) {
    return "GRACE";
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
    const days = calendarDaysAhead(b.subscriptionEndsAt!, now);
    if (days != null && days <= 7) return "EXPIRING";
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
  ACTIVE: "Активна",
  TRIAL: "Пробный период",
  GRACE: "Grace period",
  EXPIRING: "Скоро истекает",
  EXPIRED: "Просрочена",
  PENDING_PAYMENT: "Ожидает оплаты",
};

function primaryEndDate(b: {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
}): Date | null {
  if (isInSubscriptionGracePeriod(b, new Date()) && b.gracePeriodEndsAt) {
    return b.gracePeriodEndsAt;
  }
  if (b.subscriptionStatus === SubscriptionStatus.TRIALING && b.trialEndsAt) {
    return b.trialEndsAt;
  }
  return b.subscriptionEndsAt;
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
      subscriptionPlanCode: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      gracePeriodEndsAt: true,
      autoRenewEnabled: true,
    },
  });
  if (b == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const now = new Date();

  const [completedFinikCount, pendingPayment] = await Promise.all([
    prisma.subscriptionFinikPayment.count({
      where: { businessId: input.businessId, status: "completed" },
    }),
    findPendingSubscriptionFinikPayment(input.businessId),
  ]);
  const hasCompletedFinikPayment = completedFinikCount > 0;
  const firstMonthEligible = isFirstMonthPlanEligible(hasCompletedFinikPayment);
  const hasPendingPayment = pendingPayment != null;

  const displayStatus = resolveMerchantSubscriptionUiStatus(
    b,
    now,
    hasPendingPayment,
  );
  const endDate = primaryEndDate(b);
  let daysLeft: number | null = null;
  let countdownMs: number | null = null;
  if (endDate != null) {
    countdownMs = Math.max(0, endDate.getTime() - now.getTime());
    daysLeft = calendarDaysAhead(endDate, now);
  }

  const inGrace = isInSubscriptionGracePeriod(b, now);
  const entitled = hasCustomerAccessWindow(b, now);
  const storeOpenForCustomers = !b.isBlocked && b.isActive && entitled;

  return {
    ok: true,
    panel: {
      businessId: b.id,
      displayStatus,
      displayStatusLabel: STATUS_LABEL[displayStatus],
      subscriptionStatus: String(b.subscriptionStatus),
      subscriptionPlanCode: b.subscriptionPlanCode,
      subscriptionPlanLabel: planCodeLabel(b.subscriptionPlanCode),
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: b.subscriptionEndsAt?.toISOString() ?? null,
      gracePeriodEndsAt: b.gracePeriodEndsAt?.toISOString() ?? null,
      daysLeft,
      countdownMs,
      inGracePeriod: inGrace,
      autoRenewEnabled: b.autoRenewEnabled,
      storeOpenForCustomers,
      isBlocked: b.isBlocked,
      isActive: b.isActive,
      platformFinikReady: isPlatformFinikReady(),
      platformFinikPayReady: isPlatformFinikPayReady(),
      canPay:
        isOwner &&
        isPlatformFinikPayReady() &&
        !b.isBlocked &&
        !hasPendingPayment,
      isOwner,
      firstMonthEligible,
      hasPendingPayment,
      plans: merchantVisibleSubscriptionPlans({ firstMonthEligible }).map((p) => ({
        code: p.code,
        title: p.title,
        subtitle: p.subtitle,
        paidMonths: p.paidMonths,
        bonusMonths: p.bonusMonths,
        bonusDays: p.bonusDays ?? 0,
        totalMonths: totalPlanMonths(p),
        amountSom: p.amountSom,
        ...(p.badge != null ? { badge: p.badge } : {}),
        ...(p.featured === true ? { featured: true as const } : {}),
        ...(p.popular === true ? { popular: true as const } : {}),
      })),
    },
  };
}

export type CreatePlatformSubscriptionPaymentResult =
  | {
      ok: true;
      paymentUrl: string;
      subscriptionPaymentId: number;
      planCode: ArchaSubscriptionPlanCode;
      planDays: number;
      accessDaysGranted: number;
      amountSom: number;
    }
  | { ok: false; statusCode: number; error: string };

function resolvePlanCode(input: {
  planCode?: unknown;
  plan?: unknown;
}): ArchaSubscriptionPlanCode | null {
  const fromCode = parseArchaSubscriptionPlanCode(input.planCode);
  if (fromCode != null) return fromCode;
  const n =
    typeof input.plan === "number" && Number.isFinite(input.plan)
      ? Math.trunc(input.plan)
      : typeof input.plan === "string"
        ? Number(input.plan.trim())
        : NaN;
  if (n === 30 || n === 90) return legacyPlanDaysToCode(n);
  return null;
}

export async function findPendingSubscriptionFinikPayment(
  businessId: number,
): Promise<{ id: number; source: string; finikPaymentId: string | null } | null> {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.subscriptionFinikPayment.updateMany({
    where: {
      businessId,
      status: "pending",
      createdAt: { lt: staleBefore },
    },
    data: { status: "failed" },
  });
  return prisma.subscriptionFinikPayment.findFirst({
    where: { businessId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, source: true, finikPaymentId: true },
  });
}

export async function createPlatformSubscriptionPaymentSession(input: {
  telegramId: string;
  businessId: number;
  planCode?: ArchaSubscriptionPlanCode;
  plan?: 30 | 90;
  source?: ExtendBusinessSubscriptionSource;
}): Promise<CreatePlatformSubscriptionPaymentResult> {
  const { telegramId, businessId } = input;
  const planCode =
    input.planCode ??
    (input.plan != null ? legacyPlanDaysToCode(input.plan) : null) ??
    resolvePlanCode(input);

  if (planCode == null) {
    return {
      ok: false,
      statusCode: 400,
      error: "Укажите planCode: FIRST_MONTH, MONTHLY, THREE_MONTH или YEARLY",
    };
  }

  const completedFinikCount = await prisma.subscriptionFinikPayment.count({
    where: { businessId, status: "completed" },
  });
  const firstMonthEligible = isFirstMonthPlanEligible(completedFinikCount > 0);

  if (planCode === "FIRST_MONTH" && !firstMonthEligible) {
    return {
      ok: false,
      statusCode: 400,
      error:
        "Промо «Первый месяц» уже использовано. Выберите другой тариф.",
    };
  }
  if (planCode === "HALF_YEAR" && input.source !== "auto_renew") {
    return {
      ok: false,
      statusCode: 400,
      error: "Тариф «6 месяцев» больше недоступен. Выберите MONTHLY, THREE_MONTH или YEARLY.",
    };
  }
  if (planCode === "FIRST_MONTH" && input.source === "auto_renew") {
    return {
      ok: false,
      statusCode: 400,
      error: "Автопродление использует тариф «Стандарт».",
    };
  }

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, error: "Нужен корректный businessId" };
  }

  const isOwner = await platformMerchantIsStoreOwner(telegramId, businessId);
  if (!isOwner && input.source !== "auto_renew") {
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

  if (!isPlatformFinikOfficialReady()) {
    return {
      ok: false,
      statusCode: 503,
      error: PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR,
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isBlocked: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
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

  const pending = await findPendingSubscriptionFinikPayment(businessId);
  if (pending != null) {
    return {
      ok: false,
      statusCode: 409,
      error:
        "Уже есть неоплаченный счёт. Оплатите его или дождитесь отмены, прежде чем создавать новый.",
    };
  }

  const spec = planSpecForCode(planCode);
  const paymentSource = input.source ?? "finik";
  const now = new Date();
  const extensionBase = resolveSubscriptionExtensionBaseStart({
    now,
    subscriptionEndsAt: business.subscriptionEndsAt,
    subscriptionStatus: String(business.subscriptionStatus),
    trialEndsAt: business.trialEndsAt,
  });
  const endForMeta = subscriptionEndAfterPlan(extensionBase, spec.planCode);
  const accessDaysMeta = approximateAccessDays(now, endForMeta);

  const row = await prisma.subscriptionFinikPayment.create({
    data: {
      businessId,
      planDays: accessDaysMeta,
      planCode: spec.planCode,
      accessDaysGranted: accessDaysMeta,
      amountSom: spec.amountSom,
      payerTelegramId: telegramId,
      source: paymentSource === "auto_renew" ? "auto_renew" : "manual",
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
    planCode: spec.planCode,
    planDays: accessDaysMeta,
    accessDaysGranted: accessDaysMeta,
    amountSom: spec.amountSom,
  };
}

export type SubscriptionHistoryEntry = {
  id: string;
  entryType: "finik_payment" | "operator_extension";
  createdAt: string;
  amountSom: number | null;
  planCode: string | null;
  planLabel: string;
  status: string;
  externalId: string | null;
  source: string;
};

function operatorExtensionLabel(
  daysAdded: number | null,
  note: string | null,
): string {
  if (note != null && note.trim() !== "") return note.trim();
  if (daysAdded != null) return `Оператор +${daysAdded} дн.`;
  return "Продление оператором";
}

export async function listSubscriptionHistoryForMerchant(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | { ok: true; entries: SubscriptionHistoryEntry[] }
  | { ok: false; statusCode: number; error: string }
> {
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
    return { ok: false, statusCode: 403, error: "Нет доступа" };
  }

  const [finikRows, manualRows] = await Promise.all([
    prisma.subscriptionFinikPayment.findMany({
      where: { businessId: input.businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        amountSom: true,
        planCode: true,
        status: true,
        finikPaymentId: true,
        source: true,
      },
    }),
    prisma.subscriptionManualExtension.findMany({
      where: { businessId: input.businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        daysAdded: true,
        note: true,
        operatorTelegramId: true,
      },
    }),
  ]);

  const finikEntries: SubscriptionHistoryEntry[] = finikRows.map((r) => ({
    id: `finik:${r.id}`,
    entryType: "finik_payment",
    createdAt: r.createdAt.toISOString(),
    amountSom: r.amountSom,
    planCode: r.planCode,
    planLabel: planCodeLabel(r.planCode),
    status: r.status,
    externalId: r.finikPaymentId,
    source: r.source,
  }));

  const operatorEntries: SubscriptionHistoryEntry[] = manualRows.map((r) => ({
    id: `operator:${r.id}`,
    entryType: "operator_extension",
    createdAt: r.createdAt.toISOString(),
    amountSom: null,
    planCode: null,
    planLabel: operatorExtensionLabel(r.daysAdded, r.note),
    status: "applied",
    externalId: String(r.id),
    source: "operator",
  }));

  const entries = [...finikEntries, ...operatorEntries]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 50);

  return { ok: true, entries };
}

/** @deprecated Используйте listSubscriptionHistoryForMerchant. */
export async function listSubscriptionPaymentsForMerchant(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | {
      ok: true;
      payments: Array<{
        id: number;
        createdAt: string;
        amountSom: number;
        planCode: string | null;
        planLabel: string;
        status: string;
        finikPaymentId: string | null;
        source: string;
        accessDaysGranted: number | null;
      }>;
    }
  | { ok: false; statusCode: number; error: string }
> {
  const hist = await listSubscriptionHistoryForMerchant(input);
  if (!hist.ok) return hist;
  return {
    ok: true,
    payments: hist.entries
      .filter((e) => e.entryType === "finik_payment")
      .map((e) => ({
        id: Number(e.id.replace("finik:", "")),
        createdAt: e.createdAt,
        amountSom: e.amountSom ?? 0,
        planCode: e.planCode,
        planLabel: e.planLabel,
        status: e.status,
        finikPaymentId: e.externalId,
        source: e.source,
        accessDaysGranted: null,
      })),
  };
}

export async function setMerchantAutoRenew(input: {
  telegramId: string;
  businessId: number;
  enabled: boolean;
}): Promise<{ ok: true; autoRenewEnabled: boolean } | { ok: false; statusCode: number; error: string }> {
  const isOwner = await platformMerchantIsStoreOwner(
    input.telegramId,
    input.businessId,
  );
  if (!isOwner) {
    return { ok: false, statusCode: 403, error: "Только владелец может менять автопродление" };
  }
  await prisma.business.update({
    where: { id: input.businessId },
    data: { autoRenewEnabled: input.enabled },
  });
  return { ok: true, autoRenewEnabled: input.enabled };
}

export async function applyPlatformSubscriptionFinikWebhook(
  req: import("express").Request,
  rawBody: string,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; duplicate?: boolean; ignored?: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  const verify = await verifyFinikWebhookAdmission({
    finikSecret: null,
    req,
    rawBody,
    body,
    webhookPath: "/api/platform/subscription-finik-webhook",
  });
  if (!verify.ok) {
    const statusCode =
      verify.reason === "no_verify_credentials" ? 503 : 403;
    return {
      ok: false,
      statusCode,
      error:
        verify.reason === "no_verify_credentials"
          ? PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR
          : "Invalid signature",
    };
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

  const failedStatuses = new Set([
    "failed",
    "cancelled",
    "canceled",
    "declined",
    "rejected",
    "expired",
    "error",
  ]);

  if (failedStatuses.has(status)) {
    if (subRow.status === "pending") {
      await prisma.subscriptionFinikPayment.update({
        where: { id: subRow.id },
        data: { status: "failed" },
      });
    }
    return { ok: true, ignored: true };
  }

  if (!successStatuses.has(status)) {
    return { ok: true, ignored: true };
  }

  if (subRow.status === "completed") {
    return { ok: true, duplicate: true };
  }

  const planCode = parseArchaSubscriptionPlanCode(subRow.planCode);
  const source: ExtendBusinessSubscriptionSource =
    subRow.source === "auto_renew" ? "auto_renew" : "finik";

  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionFinikPayment.updateMany({
      where: {
        id: subRow!.id,
        status: { in: ["pending", "failed"] },
      },
      data: { status: "completed" },
    });
    if (claimed.count !== 1) {
      const fresh = await tx.subscriptionFinikPayment.findUnique({
        where: { id: subRow!.id },
        select: { status: true },
      });
      if (fresh?.status === "completed") {
        return { kind: "duplicate" as const };
      }
      return { kind: "ignored" as const };
    }

    const ext = await extendBusinessSubscription({
      businessId: subRow!.businessId,
      ...(planCode != null
        ? { planCode }
        : {
            operatorDaysGranted:
              subRow!.accessDaysGranted ?? subRow!.planDays,
          }),
      source,
      tx,
    });
    return { kind: "applied" as const, ext };
  });

  if (outcome.kind === "duplicate") {
    return { ok: true, duplicate: true };
  }
  if (outcome.kind === "ignored") {
    return { ok: true, ignored: true };
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
  const ids = extractFinikWebhookPaymentIds(body);
  return ids[0] ?? "";
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
  for (const dataKey of ["Data", "data"] as const) {
    const dataRaw = body[dataKey];
    if (typeof dataRaw === "object" && dataRaw !== null) {
      const data = dataRaw as Record<string, unknown>;
      candidates.push(data.external_id, data.externalId);
    }
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
          text: "✅ Оплата подписки ARCHA прошла успешно. Магазин снова открыт для покупателей.",
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