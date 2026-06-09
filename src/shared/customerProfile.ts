/**
 * Shared merchant CRM customer profile resolver (Phase 15).
 *
 * Pure, framework-agnostic helpers that derive per-merchant customer profiles
 * from existing Order rows. No new persisted "Customer" entity — the customer
 * grain is `buyerUserId` (a global User) scoped within a single `businessId`,
 * with a normalized-phone fallback for guest/legacy orders.
 *
 * Keep this module dependency-free (no Prisma/DB imports) so it stays easy to
 * unit test and reuse across server services.
 */

import { isOrderAnalyticsSuccessStatus } from "./orderAnalytics.js";

/** Minimal order shape needed for CRM aggregation (subset of Prisma Order). */
export type CustomerOrderInput = {
  id: number;
  status: string;
  total: number;
  buyerUserId: number | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date | string;
  buyerName?: string | null;
  buyerTelegramId?: string | null;
  buyerUsername?: string | null;
};

export type MerchantCustomerRow = {
  /** Stable per-merchant identity key: `user:<id>` or `phone:<normalized>`. */
  customerKey: string;
  buyerUserId: number | null;
  telegramId: string | null;
  username: string | null;
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  address: string | null;
  /** Successful (paid) orders only. */
  ordersCount: number;
  /** All orders regardless of status (created). */
  totalOrders: number;
  cancelledOrders: number;
  /** Sum of successful order totals. */
  lifetimeValue: number;
  averageOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
};

export type CustomerSegment =
  | "best"
  | "high_value"
  | "frequent"
  | "returning"
  | "recent"
  | "inactive";

/**
 * Deterministic segment thresholds (no AI). Centralized so server + tests +
 * presenters share one source of truth.
 */
export const CUSTOMER_SEGMENT_THRESHOLDS = {
  /** Returning / frequent buyers must have at least this many paid orders. */
  returningMinOrders: 2,
  frequentMinOrders: 4,
  /** High-value lifetime spend in som. */
  highValueMinLifetime: 20000,
  /** A "recent" customer placed their first order within this window. */
  recentFirstOrderDays: 14,
  /** Inactive: no paid order within this window. */
  inactiveAfterDays: 45,
  /** Top customers list size. */
  topCustomersLimit: 10,
} as const;

const KG_LOCAL_LENGTH = 10; // 0XXXXXXXXX
const KG_E164_DIGITS = 12; // 996XXXXXXXXX

/**
 * Tolerant KG phone normalization for CRM matching/search.
 * Maps `+996XXXXXXXXX` and `0XXXXXXXXX` to the canonical `996XXXXXXXXX` form.
 * Returns null when there are no usable digits.
 */
export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (digits === "") return null;
  if (digits.startsWith("996") && digits.length === KG_E164_DIGITS) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === KG_LOCAL_LENGTH) {
    return `996${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    // Bare subscriber number without country/trunk prefix.
    return `996${digits}`;
  }
  return digits;
}

/**
 * Deterministic per-merchant customer key.
 * Primary: buyerUserId (verified Telegram identity). Fallback: normalized phone.
 */
export function resolveCustomerKey(input: {
  buyerUserId: number | null | undefined;
  phone?: string | null;
}): string {
  if (input.buyerUserId != null && Number.isFinite(input.buyerUserId)) {
    return `user:${Math.trunc(input.buyerUserId)}`;
  }
  const normalized = normalizePhone(input.phone);
  if (normalized != null) return `phone:${normalized}`;
  return "anon";
}

function toTime(value: Date | string): number {
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanName(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Aggregate raw orders into per-customer rows for a single merchant.
 * Orders MUST already be scoped to one businessId by the caller.
 */
export function aggregateMerchantCustomers(
  orders: CustomerOrderInput[],
  now: Date = new Date(),
): MerchantCustomerRow[] {
  type Acc = {
    customerKey: string;
    buyerUserId: number | null;
    telegramId: string | null;
    username: string | null;
    name: string;
    phone: string | null;
    phoneNormalized: string | null;
    address: string | null;
    ordersCount: number;
    totalOrders: number;
    cancelledOrders: number;
    lifetimeValue: number;
    firstOrderTime: number;
    lastOrderTime: number;
  };

  const map = new Map<string, Acc>();

  for (const order of orders) {
    const key = resolveCustomerKey({
      buyerUserId: order.buyerUserId,
      phone: order.phone,
    });
    if (key === "anon") continue;

    const time = toTime(order.createdAt);
    const isPaid = isOrderAnalyticsSuccessStatus(order.status);
    const isCancelled =
      String(order.status ?? "").trim().toUpperCase() === "CANCELLED";

    let acc = map.get(key);
    if (acc == null) {
      acc = {
        customerKey: key,
        buyerUserId: order.buyerUserId ?? null,
        telegramId: order.buyerTelegramId ?? null,
        username: order.buyerUsername ?? null,
        name: cleanName(order.buyerName) || cleanName(order.name) || "Гость",
        phone: cleanName(order.phone) || null,
        phoneNormalized: normalizePhone(order.phone),
        address: cleanName(order.address) || null,
        ordersCount: 0,
        totalOrders: 0,
        cancelledOrders: 0,
        lifetimeValue: 0,
        firstOrderTime: time,
        lastOrderTime: time,
      };
      map.set(key, acc);
    }

    acc.totalOrders += 1;
    if (isPaid) {
      acc.ordersCount += 1;
      acc.lifetimeValue += Number(order.total) || 0;
    }
    if (isCancelled) acc.cancelledOrders += 1;

    if (time < acc.firstOrderTime) acc.firstOrderTime = time;
    // Latest order wins for display snapshots (name/phone/address).
    if (time >= acc.lastOrderTime) {
      acc.lastOrderTime = time;
      const latestName = cleanName(order.buyerName) || cleanName(order.name);
      if (latestName) acc.name = latestName;
      const latestPhone = cleanName(order.phone);
      if (latestPhone) {
        acc.phone = latestPhone;
        acc.phoneNormalized = normalizePhone(latestPhone);
      }
      const latestAddress = cleanName(order.address);
      if (latestAddress) acc.address = latestAddress;
      if (order.buyerTelegramId) acc.telegramId = order.buyerTelegramId;
      if (order.buyerUsername) acc.username = order.buyerUsername;
    }
  }

  const nowTime = now.getTime();
  const rows: MerchantCustomerRow[] = [];
  for (const acc of map.values()) {
    const daysSinceLastOrder =
      acc.lastOrderTime > 0
        ? Math.floor((nowTime - acc.lastOrderTime) / 86400000)
        : null;
    rows.push({
      customerKey: acc.customerKey,
      buyerUserId: acc.buyerUserId,
      telegramId: acc.telegramId,
      username: acc.username,
      name: acc.name,
      phone: acc.phone,
      phoneNormalized: acc.phoneNormalized,
      address: acc.address,
      ordersCount: acc.ordersCount,
      totalOrders: acc.totalOrders,
      cancelledOrders: acc.cancelledOrders,
      lifetimeValue: acc.lifetimeValue,
      averageOrderValue:
        acc.ordersCount > 0
          ? Math.round(acc.lifetimeValue / acc.ordersCount)
          : 0,
      firstOrderAt: acc.firstOrderTime > 0 ? new Date(acc.firstOrderTime).toISOString() : null,
      lastOrderAt: acc.lastOrderTime > 0 ? new Date(acc.lastOrderTime).toISOString() : null,
      daysSinceLastOrder,
    });
  }

  // Default ordering: highest lifetime value first, then most recent.
  rows.sort((a, b) => {
    if (b.lifetimeValue !== a.lifetimeValue) return b.lifetimeValue - a.lifetimeValue;
    return (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? "");
  });

  return rows;
}

/**
 * Deterministic segment classification for a single customer row.
 * `bestKeys` is the set of top-N customer keys by lifetime value (computed by
 * the caller across the full customer list).
 */
export function classifyCustomerSegments(
  row: MerchantCustomerRow,
  ctx?: { bestKeys?: Set<string> },
): CustomerSegment[] {
  const t = CUSTOMER_SEGMENT_THRESHOLDS;
  const segments: CustomerSegment[] = [];

  if (ctx?.bestKeys?.has(row.customerKey)) segments.push("best");
  if (row.lifetimeValue >= t.highValueMinLifetime) segments.push("high_value");
  if (row.ordersCount >= t.frequentMinOrders) segments.push("frequent");
  if (row.ordersCount >= t.returningMinOrders) segments.push("returning");

  const firstAgeDays =
    row.firstOrderAt != null
      ? Math.floor((Date.now() - new Date(row.firstOrderAt).getTime()) / 86400000)
      : null;
  if (
    row.ordersCount <= 1 &&
    firstAgeDays != null &&
    firstAgeDays <= t.recentFirstOrderDays
  ) {
    segments.push("recent");
  }

  if (
    row.ordersCount > 0 &&
    row.daysSinceLastOrder != null &&
    row.daysSinceLastOrder >= t.inactiveAfterDays
  ) {
    segments.push("inactive");
  }

  return segments;
}

/** True when the customer has more than one paid order. */
export function isReturningCustomer(row: MerchantCustomerRow): boolean {
  return row.ordersCount >= CUSTOMER_SEGMENT_THRESHOLDS.returningMinOrders;
}
