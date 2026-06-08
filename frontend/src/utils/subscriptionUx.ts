import type { MerchantSubscriptionPanelPayload, MerchantSubscriptionUiStatus } from "../services/platformApi";
import { ru } from "../i18n/ru";

export const SUBSCRIPTION_STATUS_CLASS: Record<
  MerchantSubscriptionUiStatus,
  string
> = {
  TRIAL: "archa-sub__badge--trial",
  ACTIVE: "archa-sub__badge--active",
  EXPIRING: "archa-sub__badge--expiring",
  GRACE: "archa-sub__badge--grace",
  EXPIRED: "archa-sub__badge--expired",
  PENDING_PAYMENT: "archa-sub__badge--pending",
};

export function subscriptionTariffLabel(
  panel: MerchantSubscriptionPanelPayload,
): string {
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
