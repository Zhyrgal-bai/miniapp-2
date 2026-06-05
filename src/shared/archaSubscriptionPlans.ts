/** Единый реестр SaaS-тарифов ARCHA (календарные месяцы, не фиксированные дни). */

export const ARCHA_SUBSCRIPTION_PLAN_CODES = [
  "MONTHLY",
  "HALF_YEAR",
  "YEARLY",
] as const;

export type ArchaSubscriptionPlanCode =
  (typeof ARCHA_SUBSCRIPTION_PLAN_CODES)[number];

export const ARCHA_SUBSCRIPTION_GRACE_DAYS = 7;
export const ARCHA_AUTO_RENEW_INVOICE_DAYS_BEFORE = 3;

const MS_DAY = 24 * 60 * 60 * 1000;

export type ArchaSubscriptionPlanDefinition = {
  code: ArchaSubscriptionPlanCode;
  title: string;
  subtitle: string;
  /** Оплачиваемые календарные месяцы. */
  paidMonths: number;
  /** Бонусные месяцы (YEARLY: +1). */
  bonusMonths: number;
  amountSom: number;
  badge?: string;
  featured?: boolean;
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

function buildPlans(): readonly ArchaSubscriptionPlanDefinition[] {
  const monthly: ArchaSubscriptionPlanDefinition = {
    code: "MONTHLY",
    title: "1 месяц",
    subtitle: "Ежемесячная подписка",
    paidMonths: 1,
    bonusMonths: 0,
    amountSom: MONTHLY_PRICE,
  };
  const halfYear: ArchaSubscriptionPlanDefinition = {
    code: "HALF_YEAR",
    title: "6 месяцев",
    subtitle: "Полгода без лишних продлений",
    paidMonths: 6,
    bonusMonths: 0,
    amountSom: envPriceSom("ARCHA_PLAN_HALF_YEAR_SOM", MONTHLY_PRICE * 6),
  };
  const yearly: ArchaSubscriptionPlanDefinition = {
    code: "YEARLY",
    title: "12 месяцев",
    subtitle: "12 оплаченных месяцев + 1 месяц в подарок",
    paidMonths: 12,
    bonusMonths: 1,
    amountSom: envPriceSom("ARCHA_PLAN_YEARLY_SOM", MONTHLY_PRICE * 12),
    badge: "+1 месяц",
    featured: true,
  };
  return [monthly, halfYear, yearly] as const;
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

export function totalPlanMonths(plan: ArchaSubscriptionPlanDefinition): number {
  return plan.paidMonths + plan.bonusMonths;
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
  const afterPaid = addCalendarMonths(baseStart, plan.paidMonths);
  if (plan.bonusMonths > 0) {
    return addCalendarMonths(afterPaid, plan.bonusMonths);
  }
  return afterPaid;
}

/** Приблизительные дни доступа (для legacy planDays / UI). */
export function approximateAccessDays(
  baseStart: Date,
  end: Date,
): number {
  return Math.max(
    1,
    Math.round((end.getTime() - baseStart.getTime()) / MS_DAY),
  );
}

export function planSpecForCode(code: ArchaSubscriptionPlanCode): {
  planCode: ArchaSubscriptionPlanCode;
  paidMonths: number;
  bonusMonths: number;
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
    totalMonths: totalPlanMonths(p),
    amountSom: p.amountSom,
  };
}

export function planCodeLabel(code: string | null | undefined): string {
  if (code == null || code.trim() === "") return "—";
  const p = getArchaSubscriptionPlan(code);
  if (p == null) return code;
  return p.code === "YEARLY" ? "YEARLY (+1 мес.)" : p.code;
}

export function formatArchaPriceSom(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} сом`;
}

export function archaPricePerMonthLabel(amountSom: number, months: number): string {
  if (months <= 0) return "";
  const perMonth = Math.round(amountSom / months);
  return `~${perMonth.toLocaleString("ru-RU")} сом/мес.`;
}

/** @deprecated Используйте addCalendarMonths / subscriptionEndAfterPlan. */
export function addCalendarDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_DAY);
}
