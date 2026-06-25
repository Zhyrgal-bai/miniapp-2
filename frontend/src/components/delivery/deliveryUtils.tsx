import type { ReactNode } from "react";
import type { ProviderDeliveryStatus, DeliveryTimelineKind } from "../../types/deliveryAdmin.types";

export type ProviderMeta = {
  label: string;
  shortLabel: string;
  accent: string;
  glyph: string;
};

const KNOWN_PROVIDERS: Record<string, ProviderMeta> = {
  yandex: { label: "Yandex Delivery", shortLabel: "Yandex", accent: "#fc3f1d", glyph: "Я" },
  glovo: { label: "Glovo", shortLabel: "Glovo", accent: "#ffc244", glyph: "G" },
  namba: { label: "Namba", shortLabel: "Namba", accent: "#00a651", glyph: "N" },
  own_courier: { label: "Свой курьер", shortLabel: "Own", accent: "#6366f1", glyph: "★" },
  dhl: { label: "DHL", shortLabel: "DHL", accent: "#ffcc00", glyph: "D" },
  ups: { label: "UPS", shortLabel: "UPS", accent: "#351c15", glyph: "U" },
};

export function getProviderMeta(providerId: string): ProviderMeta {
  const key = providerId.trim().toLowerCase();
  return (
    KNOWN_PROVIDERS[key] ?? {
      label: providerId,
      shortLabel: providerId.slice(0, 8),
      accent: "#64748b",
      glyph: providerId.slice(0, 1).toUpperCase() || "?",
    }
  );
}

export const DELIVERY_STATUS_LABELS: Record<ProviderDeliveryStatus, string> = {
  NEW: "Новая",
  CREATED: "Создана",
  ACCEPTED: "Принята",
  SEARCHING_COURIER: "Поиск курьера",
  COURIER_ASSIGNED: "Курьер назначен",
  COURIER_AT_PICKUP: "Курьер у точки",
  PICKED_UP: "Забрано",
  DELIVERING: "В пути",
  DELIVERED: "Доставлено",
  CANCELLED: "Отменено",
  FAILED: "Ошибка",
  RECOVERY_REQUIRED: "Нужно восстановление",
};

export const DELIVERY_STATUS_TONE: Record<
  ProviderDeliveryStatus,
  "neutral" | "active" | "success" | "warning" | "danger"
> = {
  NEW: "neutral",
  CREATED: "neutral",
  ACCEPTED: "active",
  SEARCHING_COURIER: "active",
  COURIER_ASSIGNED: "active",
  COURIER_AT_PICKUP: "active",
  PICKED_UP: "active",
  DELIVERING: "active",
  DELIVERED: "success",
  CANCELLED: "warning",
  FAILED: "danger",
  RECOVERY_REQUIRED: "danger",
};

export const TIMELINE_KIND_META: Record<
  DeliveryTimelineKind,
  { icon: string; label: string }
> = {
  ORDER_CREATED: { icon: "🛒", label: "Заказ" },
  PAYMENT_CONFIRMED: { icon: "💳", label: "Оплата" },
  OFFER_CALCULATED: { icon: "📊", label: "Расчёт" },
  CLAIM_CREATED: { icon: "📋", label: "Заявка" },
  CLAIM_ACCEPTED: { icon: "✅", label: "Принято" },
  STATUS_CHANGED: { icon: "🔄", label: "Статус" },
  COURIER_ASSIGNED: { icon: "🛵", label: "Курьер" },
  COURIER_ARRIVED: { icon: "📍", label: "Прибытие" },
  PICKED_UP: { icon: "📦", label: "Забор" },
  DELIVERING: { icon: "🚚", label: "Доставка" },
  DELIVERED: { icon: "🎉", label: "Завершено" },
  CANCELLED: { icon: "✖️", label: "Отмена" },
  FAILED: { icon: "⚠️", label: "Сбой" },
  RECOVERY_STARTED: { icon: "🔧", label: "Восстановление" },
  RECOVERY_RETRY: { icon: "🔁", label: "Повтор" },
  RECOVERY_RESOLVED: { icon: "✔️", label: "Восстановлено" },
  MANUAL_REFRESH: { icon: "🔄", label: "Обновление" },
  MANUAL_RETRY: { icon: "🔁", label: "Ручной повтор" },
  FORCE_REFRESH: { icon: "⚡", label: "Принудительно" },
  WEBHOOK_RECEIVED: { icon: "📡", label: "Webhook" },
};

export function formatDeliveryDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSom(amount: number | null | undefined, currency = "KGS"): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `${Math.round(amount)} ${currency}`;
}

export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="dlv-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export const DELIVERY_FILTERS_STORAGE_KEY = "archa.deliveryAdmin.filters.v1";

export const STRATEGY_LABELS: Record<string, string> = {
  CHEAPEST: "Самый дешёвый",
  FASTEST: "Самый быстрый",
  BEST_HEALTH: "Лучшее здоровье",
  MERCHANT_PRIORITY: "Приоритет магазина",
  CUSTOM: "Сбалансированный",
};
