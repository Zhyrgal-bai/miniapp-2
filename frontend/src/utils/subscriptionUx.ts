import type {
  MerchantSubscriptionPanelPayload,
  MerchantSubscriptionPlanDTO,
  MerchantSubscriptionUiStatus,
} from "../services/platformApi";
import { ru } from "../i18n/ru";

export const SUBSCRIPTION_STATUS_CLASS: Record<
  MerchantSubscriptionUiStatus,
  string
> = {
  TRIAL: "archa-sub__badge--trial",
  FREE: "archa-sub__badge--trial",
  QUOTA_EXHAUSTED: "archa-sub__badge--expired",
  ACTIVE: "archa-sub__badge--active",
  EXPIRING: "archa-sub__badge--expiring",
  GRACE: "archa-sub__badge--grace",
  EXPIRED: "archa-sub__badge--expired",
  PENDING_PAYMENT: "archa-sub__badge--pending",
};

export type FreeOrdersProgressTier = "green" | "yellow" | "red";

export type FreeOrdersProgressModel = {
  used: number;
  limit: number;
  remaining: number;
  ratio: number;
  percent: number;
  tier: FreeOrdersProgressTier;
};

export type MerchantGrowthBannerTone = "info" | "success" | "warning" | "danger";

export type MerchantGrowthBanner = {
  title: string;
  body: string;
  tone: MerchantGrowthBannerTone;
};

function safeProgressNumbers(
  usedRaw: number | null | undefined,
  limitRaw: number | null | undefined,
): { used: number; limit: number; remaining: number; ratio: number; percent: number } {
  const limit = Math.max(1, Math.round(limitRaw ?? 5));
  const used = Math.max(0, Math.min(limit, Math.round(usedRaw ?? 0)));
  const remaining = Math.max(0, limit - used);
  const ratio = used / limit;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return { used, limit, remaining, ratio, percent };
}

export function resolveFreeOrdersProgressModel(
  panel: Pick<
    MerchantSubscriptionPanelPayload,
    "freeOrdersUsed" | "freeOrdersLimit" | "displayStatus"
  >,
): FreeOrdersProgressModel {
  const base = safeProgressNumbers(panel.freeOrdersUsed, panel.freeOrdersLimit);
  const tier: FreeOrdersProgressTier =
    panel.displayStatus === "QUOTA_EXHAUSTED" || base.ratio >= 0.8
      ? "red"
      : base.ratio >= 0.6
        ? "yellow"
        : "green";
  return { ...base, tier };
}

export function resolveFirstMonthPlan(
  panel: Pick<MerchantSubscriptionPanelPayload, "plans">,
): MerchantSubscriptionPlanDTO | null {
  if (!Array.isArray(panel.plans) || panel.plans.length === 0) return null;
  return (
    panel.plans.find((p) => p.code === "FIRST_MONTH") ??
    panel.plans.find((p) => p.featured) ??
    panel.plans[0] ??
    null
  );
}

export function resolveMerchantGrowthBanner(
  panel: Pick<
    MerchantSubscriptionPanelPayload,
    "displayStatus" | "freeOrdersUsed" | "freeOrdersLimit" | "inGracePeriod"
  >,
): MerchantGrowthBanner | null {
  const progress = safeProgressNumbers(panel.freeOrdersUsed, panel.freeOrdersLimit);
  if (panel.displayStatus === "FREE") {
    if (progress.used <= 2) {
      return {
        title: "🎁 Бесплатный период продаж активен",
        body: `Использовано ${progress.used}/${progress.limit}. Осталось ${progress.remaining} бесплатных заказа.`,
        tone: "success",
      };
    }
    if (progress.used === 3) {
      return {
        title: "🚀 Отличный старт — уже 3 заказа",
        body: `Использовано ${progress.used}/${progress.limit}. Подготовьте оплату первого месяца, чтобы не останавливать продажи.`,
        tone: "warning",
      };
    }
    return {
      title: "⚠️ Остался последний бесплатный заказ",
      body: `Сейчас ${progress.used}/${progress.limit}. Подключите подписку заранее, чтобы магазин не закрывался.`,
      tone: "danger",
    };
  }
  if (panel.displayStatus === "QUOTA_EXHAUSTED") {
    return {
      title: `🎉 Поздравляем! Вы получили первые ${progress.limit} заказов`,
      body: "Подключите первый платный месяц и сразу продолжайте принимать новые заказы.",
      tone: "warning",
    };
  }
  if (panel.displayStatus === "ACTIVE") {
    return {
      title: "✅ Подписка активна",
      body: "Магазин открыт для покупателей, бот и витрина работают без ограничений.",
      tone: "success",
    };
  }
  if (panel.displayStatus === "GRACE" || panel.inGracePeriod) {
    return {
      title: "⏳ Льготный период",
      body: "Оплатите подписку, чтобы не приостанавливать приём новых заказов.",
      tone: "warning",
    };
  }
  return null;
}

export function subscriptionTariffLabel(
  panel: MerchantSubscriptionPanelPayload,
): string {
  if (panel.displayStatus === "FREE") {
    const used = panel.freeOrdersUsed ?? 0;
    const limit = panel.freeOrdersLimit ?? 5;
    return `🎁 Бесплатные заказы ${used}/${limit}`;
  }
  if (panel.displayStatus === "QUOTA_EXHAUSTED") {
    return "⛔ Лимит бесплатных заказов";
  }
  if (panel.displayStatus === "TRIAL") {
    return "🟢 Пробный период";
  }
  const raw = panel.subscriptionPlanLabel?.trim() ?? "";
  if (raw === "" || raw === "—") {
    if (panel.displayStatus === "GRACE") return ru.platform.gracePeriod;
    if (panel.displayStatus === "EXPIRED") return "Подписка не активна";
    return panel.displayStatusLabel;
  }
  return raw;
}

export function finikAvailabilityMessage(
  panel: MerchantSubscriptionPanelPayload,
): { kind: "info" | "warn"; text: string } | null {
  if (panel.isBlocked || !panel.isOwner) return null;
  if (panel.platformFinikPayReady) return null;
  if (panel.platformFinikReady) {
    return {
      kind: "warn",
      text: "Finik подключён частично — оплата временно недоступна. Напишите в поддержку платформы.",
    };
  }
  return {
    kind: "warn",
    text: "Онлайн-оплата временно недоступна. Напишите в поддержку платформы.",
  };
}

export function platformFinikStatusLabel(
  panel: Pick<
    MerchantSubscriptionPanelPayload,
    "platformFinikReady" | "platformFinikPayReady"
  >,
): string {
  if (panel.platformFinikPayReady) return "🟢 Finik подключён";
  if (panel.platformFinikReady) return "🟡 Finik: оплата недоступна";
  return "🔴 Finik не подключён";
}
