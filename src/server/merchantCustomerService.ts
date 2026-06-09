/**
 * Merchant CRM service (Phase 15).
 *
 * Derives per-merchant customer profiles, history, dashboard KPIs and
 * deterministic segments from existing Order/OrderItem/User data. Read-only,
 * additive — no checkout or schema changes. Always scoped by businessId.
 */

import { prisma } from "./db.js";
import {
  CUSTOMER_SEGMENT_THRESHOLDS,
  aggregateMerchantCustomers,
  classifyCustomerSegments,
  isReturningCustomer,
  normalizePhone,
  resolveCustomerKey,
  type CustomerOrderInput,
  type CustomerSegment,
  type MerchantCustomerRow,
} from "../shared/customerProfile.js";
import { isOrderAnalyticsSuccessStatus } from "../shared/orderAnalytics.js";
import {
  extractVerticalPreferences,
  type CustomerPreference,
} from "../shared/customerVerticalPrefs.js";
import { formatOrderLineSummary } from "../shared/businessCommerce.js";

export type MerchantCustomerListRow = MerchantCustomerRow & {
  segments: CustomerSegment[];
};

export type MerchantCustomerListPayload = {
  total: number;
  returningCount: number;
  customers: MerchantCustomerListRow[];
};

export type MerchantCustomerDashboardPayload = {
  rangeDays: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatPurchaseRate: number;
  averageOrdersPerCustomer: number;
  averageLifetimeValue: number;
  totalLifetimeValue: number;
  customerGrowth: Array<{ day: string; newCustomers: number }>;
  topCustomers: MerchantCustomerListRow[];
};

export type MerchantCustomerInsightsPayload = {
  best: MerchantCustomerListRow[];
  highValue: MerchantCustomerListRow[];
  frequent: MerchantCustomerListRow[];
  recent: MerchantCustomerListRow[];
  inactive: MerchantCustomerListRow[];
};

export type MerchantCustomerDetailPayload = {
  customer: MerchantCustomerListRow | null;
  orders: Array<{
    id: number;
    orderNumber: string | null;
    status: string;
    total: number;
    createdAt: string;
    summary: string;
  }>;
  favoriteProducts: Array<{ productId: number | null; name: string; quantity: number }>;
  favoriteCategories: Array<{ categoryId: number | null; name: string; quantity: number }>;
  recentAddresses: string[];
  preferences: CustomerPreference[];
};

type OrderRowForCrm = {
  id: number;
  orderNumber: string | null;
  status: string;
  total: number;
  buyerUserId: number | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  buyerUser: {
    name: string | null;
    telegramId: string | null;
    telegramUsername: string | null;
  } | null;
};

function toCustomerOrderInput(o: OrderRowForCrm): CustomerOrderInput {
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    buyerUserId: o.buyerUserId,
    name: o.name,
    phone: o.phone,
    address: o.address,
    createdAt: o.createdAt,
    buyerName: o.buyerUser?.name ?? null,
    buyerTelegramId: o.buyerUser?.telegramId ?? null,
    buyerUsername: o.buyerUser?.telegramUsername ?? null,
  };
}

async function loadMerchantOrders(businessId: number): Promise<OrderRowForCrm[]> {
  const rows = await prisma.order.findMany({
    where: { businessId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      buyerUserId: true,
      name: true,
      phone: true,
      address: true,
      createdAt: true,
      buyerUser: {
        select: { name: true, telegramId: true, telegramUsername: true },
      },
    },
  });
  return rows as OrderRowForCrm[];
}

function topKeysByLifetime(rows: MerchantCustomerRow[]): Set<string> {
  return new Set(
    [...rows]
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, CUSTOMER_SEGMENT_THRESHOLDS.topCustomersLimit)
      .filter((r) => r.lifetimeValue > 0)
      .map((r) => r.customerKey),
  );
}

function withSegments(
  rows: MerchantCustomerRow[],
  bestKeys: Set<string>,
): MerchantCustomerListRow[] {
  return rows.map((row) => ({
    ...row,
    segments: classifyCustomerSegments(row, { bestKeys }),
  }));
}

export async function buildMerchantCustomerList(input: {
  businessId: number;
  search?: string | null;
  segment?: CustomerSegment | null;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<MerchantCustomerListPayload> {
  const orders = await loadMerchantOrders(input.businessId);
  const rows = aggregateMerchantCustomers(orders.map(toCustomerOrderInput));
  const bestKeys = topKeysByLifetime(rows);
  let list = withSegments(rows, bestKeys);

  const search = String(input.search ?? "").trim().toLowerCase();
  if (search !== "") {
    const searchPhone = normalizePhone(search);
    list = list.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(search);
      const phoneMatch =
        searchPhone != null && c.phoneNormalized != null
          ? c.phoneNormalized.includes(searchPhone)
          : (c.phone ?? "").toLowerCase().includes(search);
      return nameMatch || phoneMatch;
    });
  }

  if (input.segment != null) {
    list = list.filter((c) => c.segments.includes(input.segment as CustomerSegment));
  }

  const returningCount = list.filter((c) => isReturningCustomer(c)).length;
  const total = list.length;

  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(200, Math.max(1, Math.trunc(input.limit ?? 50)));
  const customers = list.slice(offset, offset + limit);

  return { total, returningCount, customers };
}

export async function buildMerchantCustomerDashboard(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MerchantCustomerDashboardPayload> {
  const now = new Date();
  const since = new Date(now.getTime() - input.rangeDays * 86400000);
  const orders = await loadMerchantOrders(input.businessId);
  const rows = aggregateMerchantCustomers(orders.map(toCustomerOrderInput), now);
  const bestKeys = topKeysByLifetime(rows);
  const list = withSegments(rows, bestKeys);

  const totalCustomers = list.length;
  const returningCustomers = list.filter((c) => isReturningCustomer(c)).length;
  const newCustomers = list.filter(
    (c) => c.firstOrderAt != null && new Date(c.firstOrderAt) >= since,
  ).length;
  const totalPaidOrders = list.reduce((s, c) => s + c.ordersCount, 0);
  const totalLifetimeValue = list.reduce((s, c) => s + c.lifetimeValue, 0);
  const buyersWithPaid = list.filter((c) => c.ordersCount > 0).length;

  const repeatPurchaseRate =
    buyersWithPaid > 0
      ? Math.round((returningCustomers / buyersWithPaid) * 1000) / 10
      : 0;
  const averageOrdersPerCustomer =
    buyersWithPaid > 0
      ? Math.round((totalPaidOrders / buyersWithPaid) * 10) / 10
      : 0;
  const averageLifetimeValue =
    buyersWithPaid > 0 ? Math.round(totalLifetimeValue / buyersWithPaid) : 0;

  const growthMap = new Map<string, number>();
  for (const c of list) {
    if (c.firstOrderAt == null) continue;
    const at = new Date(c.firstOrderAt);
    if (at < since) continue;
    const day = c.firstOrderAt.slice(0, 10);
    growthMap.set(day, (growthMap.get(day) ?? 0) + 1);
  }
  const customerGrowth = [...growthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, newCustomers: count }));

  const topCustomers = list
    .filter((c) => c.lifetimeValue > 0)
    .slice(0, CUSTOMER_SEGMENT_THRESHOLDS.topCustomersLimit);

  return {
    rangeDays: input.rangeDays,
    totalCustomers,
    newCustomers,
    returningCustomers,
    repeatPurchaseRate,
    averageOrdersPerCustomer,
    averageLifetimeValue,
    totalLifetimeValue,
    customerGrowth,
    topCustomers,
  };
}

export async function buildMerchantCustomerInsights(input: {
  businessId: number;
}): Promise<MerchantCustomerInsightsPayload> {
  const orders = await loadMerchantOrders(input.businessId);
  const rows = aggregateMerchantCustomers(orders.map(toCustomerOrderInput));
  const bestKeys = topKeysByLifetime(rows);
  const list = withSegments(rows, bestKeys);

  const bySegment = (segment: CustomerSegment) =>
    list.filter((c) => c.segments.includes(segment)).slice(0, 20);

  return {
    best: list.filter((c) => c.segments.includes("best")),
    highValue: bySegment("high_value"),
    frequent: bySegment("frequent"),
    recent: bySegment("recent"),
    inactive: bySegment("inactive"),
  };
}

export async function buildMerchantCustomerDetail(input: {
  businessId: number;
  customerKey: string;
}): Promise<MerchantCustomerDetailPayload> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { businessType: true },
  });
  const businessType = String(business?.businessType ?? "");

  const orders = await prisma.order.findMany({
    where: { businessId: input.businessId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      buyerUserId: true,
      name: true,
      phone: true,
      address: true,
      createdAt: true,
      buyerUser: {
        select: { name: true, telegramId: true, telegramUsername: true },
      },
      items: {
        select: {
          productId: true,
          name: true,
          size: true,
          color: true,
          quantity: true,
          options: true,
          product: {
            select: { categoryId: true, category: { select: { name: true } } },
          },
        },
      },
    },
  });

  const matching = orders.filter(
    (o) =>
      resolveCustomerKey({ buyerUserId: o.buyerUserId, phone: o.phone }) ===
      input.customerKey,
  );

  const rows = aggregateMerchantCustomers(
    matching.map((o) =>
      toCustomerOrderInput(o as unknown as OrderRowForCrm),
    ),
  );
  const firstRow = rows[0];
  const customer: MerchantCustomerListRow | null =
    firstRow != null
      ? withSegments([firstRow], new Set<string>([firstRow.customerKey]))[0] ?? null
      : null;
  if (customer != null) {
    // `best` only meaningful across full list; drop it in single-customer detail.
    customer.segments = customer.segments.filter((s) => s !== "best");
  }

  const orderHistory = matching.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber?.trim() || null,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    summary: o.items
      .map((it) =>
        formatOrderLineSummary({
          businessType,
          size: it.size,
          color: it.color,
          options: (it.options as Record<string, unknown> | null) ?? null,
        }),
      )
      .filter((s) => s.trim() !== "")
      .join("; "),
  }));

  const productMap = new Map<string, { productId: number | null; name: string; quantity: number }>();
  const categoryMap = new Map<number, { categoryId: number | null; name: string; quantity: number }>();
  const prefItems: Array<{ size?: string | null; color?: string | null; options?: Record<string, unknown> | null }> = [];

  for (const o of matching) {
    const paid = isOrderAnalyticsSuccessStatus(o.status);
    for (const it of o.items) {
      prefItems.push({
        size: it.size,
        color: it.color,
        options: (it.options as Record<string, unknown> | null) ?? null,
      });
      if (!paid) continue;
      const pKey = `${it.productId ?? "x"}:${it.name}`;
      const prod = productMap.get(pKey) ?? {
        productId: it.productId ?? null,
        name: it.name,
        quantity: 0,
      };
      prod.quantity += it.quantity;
      productMap.set(pKey, prod);

      const catId = it.product?.categoryId;
      if (catId != null) {
        const cat = categoryMap.get(catId) ?? {
          categoryId: catId,
          name: it.product?.category?.name ?? "Без категории",
          quantity: 0,
        };
        cat.quantity += it.quantity;
        categoryMap.set(catId, cat);
      }
    }
  }

  const favoriteProducts = [...productMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
  const favoriteCategories = [...categoryMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const recentAddresses: string[] = [];
  const seenAddr = new Set<string>();
  for (const o of matching) {
    const addr = (o.address ?? "").trim();
    if (addr === "" || addr === "—") continue;
    const lower = addr.toLowerCase();
    if (seenAddr.has(lower)) continue;
    seenAddr.add(lower);
    recentAddresses.push(addr);
    if (recentAddresses.length >= 5) break;
  }

  const preferences = extractVerticalPreferences(businessType, prefItems);

  return {
    customer,
    orders: orderHistory,
    favoriteProducts,
    favoriteCategories,
    recentAddresses,
    preferences,
  };
}
