import type { PlatformMyBusinessDTO } from "../../services/platformApi";
import { ru } from "../../i18n/ru";

export function platformStatusLabel(status: string): string {
  const map: Record<string, string> = {
    blocked: "Заблокирован",
    inactive: "Не активен",
    subscription_expired: "Подписка истекла",
    trialing: "Пробный период",
    active: "Активен",
    past_due: "Просрочен платёж",
    canceled: "Отменён",
    expired: "Истёк",
  };
  return map[status] ?? status;
}

export function businessTypeLabel(type: string | undefined): string {
  const map: Record<string, string> = {
    clothing: "Одежда",
    coffee: "Кофейня",
    fastfood: "Фастфуд",
    flowers: "Цветы",
  };
  return type != null && map[type] != null ? map[type] : type ?? "Магазин";
}

export function webhookUrlLine(b: PlatformMyBusinessDTO): string {
  const u = b.webhookUrl;
  if (u != null && u.trim() !== "") return u.trim();
  return "URL вебхука не задан";
}

export type MerchantAdminSection = "products" | "design" | "orders";

/** Открыть админку магазина с tenant в URL и hash-разделом. */
export function merchantAdminNavigateTarget(
  b: Pick<PlatformMyBusinessDTO, "id" | "slug">,
  section: MerchantAdminSection,
): string {
  const s = typeof b.slug === "string" ? b.slug.trim() : "";
  const base =
    s !== ""
      ? `/s/${encodeURIComponent(s)}`
      : `/?shop=${encodeURIComponent(String(b.id))}`;
  const hash: Record<MerchantAdminSection, string> = {
    products: "#/admin/products",
    design: "#/admin/design",
    orders: "#/admin/orders",
  };
  return `${base}${hash[section]}`;
}

export function miniAppOpenUrl(b: Pick<PlatformMyBusinessDTO, "id" | "slug">): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin.replace(/\/$/, "");
  const s = typeof b.slug === "string" ? b.slug.trim() : "";
  if (s !== "") return `${origin}/s/${encodeURIComponent(s)}`;
  return `${origin}/?shop=${encodeURIComponent(String(b.id))}`;
}

export function formatRuDateShort(iso: string | null): string | null {
  if (iso == null || iso.trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDaysRemaining(iso: string | null): string | null {
  if (iso == null || iso.trim() === "") return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days < 0) return `истекло ${Math.abs(days)} дн. назад`;
  if (days === 0) return "истекает сегодня";
  return `${days} дн.`;
}

export function botRunBadge(b: PlatformMyBusinessDTO): { label: string; className: string } {
  if (b.isBlocked) {
    return { label: "Заблокирован", className: "mp-v2-badge mp-v2-badge--blocked" };
  }
  if (!b.isActive) {
    return { label: "Отключён", className: "mp-v2-badge mp-v2-badge--off" };
  }
  return { label: "Активен", className: "mp-v2-badge mp-v2-badge--ok" };
}

export function subscriptionBadge(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "trialing") {
    return { label: ru.platform.trial, className: "mp-v2-badge mp-v2-badge--trial" };
  }
  if (s === "active") {
    return { label: ru.platform.active, className: "mp-v2-badge mp-v2-badge--active" };
  }
  if (s === "inactive") {
    return { label: ru.platform.inactive, className: "mp-v2-badge mp-v2-badge--warn" };
  }
  if (s === "subscription_expired" || s === "expired") {
    return { label: ru.platform.expired, className: "mp-v2-badge mp-v2-badge--warn" };
  }
  if (s === "past_due") {
    return { label: ru.platform.pastDue, className: "mp-v2-badge mp-v2-badge--warn" };
  }
  if (s === "canceled") {
    return { label: ru.platform.canceled, className: "mp-v2-badge" };
  }
  return { label: platformStatusLabel(status), className: "mp-v2-badge" };
}

export function webhookBadge(ws: "OK" | "ERROR"): { label: string; className: string } {
  if (ws === "OK") {
    return {
      label: ru.platform.webhookOk,
      className: "mp-v2-badge mp-v2-badge--ok",
    };
  }
  return {
    label: ru.platform.webhookError,
    className: "mp-v2-badge mp-v2-badge--warn",
  };
}

export function storeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
