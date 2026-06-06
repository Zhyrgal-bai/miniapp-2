import type { MerchantSubscriptionPanelPayload, MerchantSubscriptionUiStatus } from "../services/platformApi";

export const SUBSCRIPTION_STATUS_CLASS: Record<
  MerchantSubscriptionUiStatus,
  string
> = {
  TRIAL: "archa-sub__badge--trial",
  ACTIVE: "archa-sub__badge--active",
  EXPIRING: "archa-sub__badge--expiring",
  GRACE: "archa-sub__badge--grace",
  EXPIRED: "archa-sub__badge--expired",
};

export function subscriptionTariffLabel(
  panel: MerchantSubscriptionPanelPayload,
): string {
  if (panel.displayStatus === "TRIAL") {
    return "🟢 Пробный период";
  }
  const raw = panel.subscriptionPlanLabel?.trim() ?? "";
  if (raw === "" || raw === "—") {
    if (panel.displayStatus === "GRACE") return "Grace period";
    if (panel.displayStatus === "EXPIRED") return "Подписка не активна";
    return panel.displayStatusLabel;
  }
  return raw;
}

export function finikAvailabilityMessage(
  panel: MerchantSubscriptionPanelPayload,
): { kind: "info" | "warn"; text: string } | null {
  if (panel.isBlocked || !panel.isOwner) return null;
  if (panel.platformFinikReady) return null;
  if (panel.displayStatus === "TRIAL") {
    return {
      kind: "info",
      text: "После окончания пробного периода вы сможете оплатить подписку через Finik.",
    };
  }
  return {
    kind: "warn",
    text: "Онлайн-оплата временно недоступна. Напишите в поддержку платформы.",
  };
}
