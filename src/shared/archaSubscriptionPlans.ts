/** Единый реестр SaaS-тарифов ARCHA (календарные месяцы + bonusDays). */

export const ARCHA_SUBSCRIPTION_PLAN_CODES = [
  "FIRST_MONTH",
  "MONTHLY",
  "THREE_MONTH",
  "HALF_YEAR",
  "YEARLY",
] as const;

export type ArchaSubscriptionPlanCode =
  (typeof ARCHA_SUBSCRIPTION_PLAN_CODES)[number];

/** Тарифы merchant UI (без legacy HALF_YEAR). */
export const ARCHA_MERCHANT_VISIBLE_PLAN_CODES = [
  "FIRST_MONTH",
  "MONTHLY",
  "THREE_MONTH",
  "YEARLY",
] as const;

export type ArchaMerchantVisiblePlanCode =
  (typeof ARCHA_MERCHANT_VISIBLE_PLAN_CODES)[number];

export const ARCHA_SUBSCRIPTION_GRACE_DAYS = 7;
export const ARCHA_AUTO_RENEW_INVOICE_DAYS_BEFORE = 3;

const MS_DAY = 24 * 60 * 60 * 1000;

export type ArchaSubscriptionPlanDefinition = {
  code: ArchaSubscriptionPlanCode;
  title: string;
  subtitle: string;
  /** Оплачиваемые календарные месяцы. */
  paidMonths: number;
  /** Бонусные календарные месяцы (YEARLY: +2). */
  bonusMonths: number;
  /** Бонусные дни (THREE_MONTH: +15). */
  bonusDays?: number;
  amountSom: number;
  badge?: string;
  featured?: boolean;
  popular?: boolean;
};

function envPriceSom(key: string, fallback: number): number {
  try {
    const proc = (globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const raw = proc?.env?.[key];
    if (raw == null || String(raw).trim() === "") return fallback;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  } catch {
    return fallback;
  }
}

const MONTHLY_PRICE = envPriceSom("ARCHA_PLAN_MONTHLY_SOM", 5500);
export const ARCHA_FIRST_MONTH_PRICE_SOM = envPriceSom(
  "ARCHA_FIRST_MONTH_SOM",
  1500,
);

function discountedPlanPrice(months: number, discountPercent: number): number {
  return Math.round(MONTHLY_PRICE * months * (1 - discountPercent / 100));
}

function buildPlans(): readonly ArchaSubscriptionPlanDefinition[] {
  const firstMonth: ArchaSubscriptionPlanDefinition = {
    code: "FIRST_MONTH",
    title: "Первый месяц",
    subtitle: "Для новых магазинов",
    paidMonths: 1,
    bonusMonths: 0,
    amountSom: ARCHA_FIRST_MONTH_PRICE_SOM,
    badge: "Промо",
  };
  const monthly: ArchaSubscriptionPlanDefinition = {
    code: "MONTHLY",
    title: "Стандарт",
    subtitle: "5500 сом / месяц",
    paidMonths: 1,
    bonusMonths: 0,
    amountSom: MONTHLY_PRICE,
  };
  const threeMonth: ArchaSubscriptionPlanDefinition = {
    code: "THREE_MONTH",
    title: "3 месяца",
    subtitle: "−5% · +15 дней бонус",
    paidMonths: 3,
    bonusMonths: 0,
    bonusDays: 15,
    amountSom: envPriceSom(
      "ARCHA_PLAN_THREE_MONTH_SOM",
      discountedPlanPrice(3, 5),
    ),
    badge: "−5%",
    popular: true,
  };
  const halfYear: ArchaSubscriptionPlanDefinition = {
    code: "HALF_YEAR",
    title: "6 месяцев",
    subtitle: "Legacy — только auto-renew",
    paidMonths: 6,
    bonusMonths: 0,
    amountSom: envPriceSom("ARCHA_PLAN_HALF_YEAR_SOM", MONTHLY_PRICE * 6),
  };
  const yearly: ArchaSubscriptionPlanDefinition = {
    code: "YEARLY",
    title: "Годовой",
    subtitle: "12 месяцев + 2 бесплатно · скидка 20%",
    paidMonths: 12,
    bonusMonths: 2,
    amountSom: envPriceSom(
      "ARCHA_PLAN_YEARLY_SOM",
      discountedPlanPrice(12, 20),
    ),
    badge: "−20%",
    featured: true,
  };
  return [firstMonth, monthly, threeMonth, halfYear, yearly] as const;
}

export const ARCHA_SUBSCRIPTION_PLANS: readonly ArchaSubscriptionPlanDefinition[] =
  buildPlans();

export function getArchaSubscriptionPlan(
  code: string,
): ArchaSubscriptionPlanDefinition | null {
  const c = code.trim().toUpperCase();
  return ARCHA_SUBSCRIPTION_PLANS.find((p) => p.code === c) ?? null;
}

export function parseArchaSubscriptionPlanCode(
  raw: unknown,
): ArchaSubscriptionPlanCode | null {
  if (typeof raw !== "string") return null;
  const p = getArchaSubscriptionPlan(raw);
  return p?.code ?? null;
}

/** Legacy Finik API: plan 30 → MONTHLY, 90 → HALF_YEAR. */
export function legacyPlanDaysToCode(days: 30 | 90): ArchaSubscriptionPlanCode {
  return days === 30 ? "MONTHLY" : "HALF_YEAR";
}

/** Календарное добавление месяцев (Jan 31 + 1 мес → Feb 28/29). */
export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const origDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== origDay) {
    d.setDate(0);
  }
  return d;
}

export function addCalendarDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_DAY);
}

export function totalPlanMonths(plan: ArchaSubscriptionPlanDefinition): number {
  return plan.paidMonths + plan.bonusMonths;
}

/** База продления: активная подписка → trialEndsAt на trial → now. */
export function resolveSubscriptionExtensionBaseStart(input: {
  now: Date;
  subscriptionEndsAt: Date | null;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
}): Date {
  const t = input.now.getTime();
  if (
    input.subscriptionEndsAt != null &&
    input.subscriptionEndsAt.getTime() > t
  ) {
    return input.subscriptionEndsAt;
  }
  if (
    input.subscriptionStatus.trim().toUpperCase() === "TRIALING" &&
    input.trialEndsAt != null &&
    input.trialEndsAt.getTime() > t
  ) {
    return input.trialEndsAt;
  }
  return input.now;
}

/** Конец подписки после продления тарифом от baseStart. */
export function subscriptionEndAfterPlan(
  baseStart: Date,
  planCode: ArchaSubscriptionPlanCode,
): Date {
  const plan = getArchaSubscriptionPlan(planCode);
  if (plan == null) {
    throw new Error(`Unknown subscription plan: ${planCode}`);
  }
  let end = addCalendarMonths(baseStart, plan.paidMonths);
  if (plan.bonusMonths > 0) {
    end = addCalendarMonths(end, plan.bonusMonths);
  }
  if (plan.bonusDays != null && plan.bonusDays > 0) {
    end = addCalendarDays(end, plan.bonusDays);
  }
  return end;
}

/** Приблизительные дни доступа от start до end (для Finik meta / UI). */
export function approximateAccessDays(baseStart: Date, end: Date): number {
  return Math.max(
    1,
    Math.round((end.getTime() - baseStart.getTime()) / MS_DAY),
  );
}

export function planSpecForCode(code: ArchaSubscriptionPlanCode): {
  planCode: ArchaSubscriptionPlanCode;
  paidMonths: number;
  bonusMonths: number;
  bonusDays: number;
  totalMonths: number;
  amountSom: number;
} {
  const p = getArchaSubscriptionPlan(code);
  if (p == null) {
    throw new Error(`Unknown subscription plan: ${code}`);
  }
  return {
    planCode: p.code,
    paidMonths: p.paidMonths,
    bonusMonths: p.bonusMonths,
    bonusDays: p.bonusDays ?? 0,
    totalMonths: totalPlanMonths(p),
    amountSom: p.amountSom,
  };
}

export function planCodeLabel(code: string | null | undefined): string {
  if (code == null || code.trim() === "") return "—";
  const c = code.trim().toUpperCase();
  if (c === "FIRST_MONTH") return "Первый месяц";
  if (c === "THREE_MONTH") return "3 месяца";
  const p = getArchaSubscriptionPlan(code);
  if (p == null) return code;
  if (p.code === "YEARLY") return "Годовой (+2 мес.)";
  if (p.code === "MONTHLY") return "Стандарт";
  return p.code;
}

/** Планы для merchant UI с учётом eligibility первого месяца. */
export function merchantVisibleSubscriptionPlans(input: {
  firstMonthEligible: boolean;
}): ArchaSubscriptionPlanDefinition[] {
  const codes: ArchaMerchantVisiblePlanCode[] = input.firstMonthEligible
    ? ["FIRST_MONTH", "MONTHLY", "THREE_MONTH", "YEARLY"]
    : ["MONTHLY", "THREE_MONTH", "YEARLY"];
  return codes
    .map((c) => getArchaSubscriptionPlan(c))
    .filter((p): p is ArchaSubscriptionPlanDefinition => p != null);
}

/** Первый месяц 1500 — только до первой успешной Finik-оплаты. */
export function isFirstMonthPlanEligible(hasCompletedFinikPayment: boolean): boolean {
  return !hasCompletedFinikPayment;
}

export function formatArchaPriceSom(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} сом`;
}

export function archaPricePerMonthLabel(amountSom: number, months: number): string {
  if (months <= 0) return "";
  const perMonth = Math.round(amountSom / months);
  return `~${perMonth.toLocaleString("ru-RU")} сом/мес.`;
}
