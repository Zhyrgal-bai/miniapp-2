/**
 * Merchant CRM presenters (Phase 15.6) — pure functions for the customers UI.
 * No API calls; easy to unit test and reuse across CRM widgets.
 */

import type {
  CustomerSegment,
  MerchantCustomerRow,
} from "../services/admin.service";

export type CustomerBadge = {
  segment: CustomerSegment;
  label: string;
  tone: "gold" | "green" | "blue" | "violet" | "red";
};

const SEGMENT_BADGES: Record<CustomerSegment, Omit<CustomerBadge, "segment">> = {
  best: { label: "Лучший", tone: "gold" },
  high_value: { label: "Высокий чек", tone: "violet" },
  frequent: { label: "Частый", tone: "green" },
  returning: { label: "Постоянный", tone: "blue" },
  recent: { label: "Новый", tone: "green" },
  inactive: { label: "Неактивный", tone: "red" },
};

/** Customer-facing segment filters for the list UI. */
export const CUSTOMER_SEGMENT_FILTERS: Array<{
  id: CustomerSegment;
  label: string;
}> = [
  { id: "best", label: "Лучшие" },
  { id: "high_value", label: "Высокий чек" },
  { id: "frequent", label: "Частые" },
  { id: "returning", label: "Постоянные" },
  { id: "recent", label: "Новые" },
  { id: "inactive", label: "Неактивные" },
];

export function resolveCustomerBadges(
  segments: CustomerSegment[] | null | undefined,
): CustomerBadge[] {
  if (!Array.isArray(segments)) return [];
  return segments
    .filter((s) => s in SEGMENT_BADGES)
    .map((segment) => ({ segment, ...SEGMENT_BADGES[segment] }));
}

export function formatLifetimeValue(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0 сом";
  return `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " сом";
}

export function formatCustomerLastOrder(
  daysSinceLastOrder: number | null | undefined,
): string {
  if (daysSinceLastOrder == null) return "Нет заказов";
  if (daysSinceLastOrder <= 0) return "Сегодня";
  if (daysSinceLastOrder === 1) return "Вчера";
  if (daysSinceLastOrder < 7) return `${daysSinceLastOrder} дн. назад`;
  if (daysSinceLastOrder < 30) {
    const weeks = Math.floor(daysSinceLastOrder / 7);
    return `${weeks} нед. назад`;
  }
  const months = Math.floor(daysSinceLastOrder / 30);
  return `${months} мес. назад`;
}

export function customerInitials(name: string | null | undefined): string {
  const clean = String(name ?? "").trim();
  if (clean === "") return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export type CustomerSort = "value" | "orders" | "recent";

export function sortCustomers(
  rows: MerchantCustomerRow[],
  sort: CustomerSort,
): MerchantCustomerRow[] {
  const copy = [...rows];
  if (sort === "orders") {
    copy.sort((a, b) => b.ordersCount - a.ordersCount);
  } else if (sort === "recent") {
    copy.sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
  } else {
    copy.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  }
  return copy;
}
