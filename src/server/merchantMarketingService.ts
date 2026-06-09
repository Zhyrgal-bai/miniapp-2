/**
 * Merchant marketing service (Phase 16.1/16.3/16.6).
 *
 * Promotions + campaigns CRUD and a marketing dashboard. Reuses CRM segments,
 * analytics, and the existing Promo table. COUPON_PERCENT promotions mirror to
 * the Promo table so checkout enforcement is unchanged; all other types are
 * management/analytics only and never alter checkout math.
 */

import { prisma } from "./db.js";
import {
  PROMOTION_TYPES,
  resolvePromotionStatus,
  validatePromotionDefinition,
  type PromotionDefinition,
  type PromotionStatus,
  type PromotionType,
} from "../shared/promotionEngine.js";
import {
  resolveCampaignStatus,
  computeCampaignRoi,
  validateCampaignDefinition,
  type CampaignDefinition,
  type CampaignStatus,
} from "../shared/campaignModel.js";
import type { CustomerSegment } from "../shared/customerProfile.js";
import { createPromoDb, deletePromoByCodeDb, normalizePromoCode } from "./promoRepo.js";
import { buildMerchantCustomerDashboard } from "./merchantCustomerService.js";
import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";

const db = prisma as any;

export type PromotionRow = PromotionDefinition & { status: PromotionStatus };
export type CampaignRow = CampaignDefinition & { status: CampaignStatus };

export type MarketingDashboardPayload = {
  rangeDays: number;
  activeCampaigns: number;
  totalCampaigns: number;
  activePromotions: number;
  totalPromotions: number;
  totalRedemptions: number;
  customerGrowth: Array<{ day: string; newCustomers: number }>;
  repeatCustomers: number;
  topPromotions: Array<{ id: number; title: string; type: PromotionType; redemptions: number }>;
  topSegments: Array<{ segment: CustomerSegment | "all"; customers: number }>;
  bestProducts: Array<{ productId: number | null; name: string; quantity: number }>;
  campaignRoi: Array<{ id: number; title: string; budgetSom: number; roi: number | null }>;
};

function toIsoOrNull(value: Date | null): string | null {
  return value == null ? null : value.toISOString();
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function rowToPromotion(r: any): PromotionRow {
  const def: PromotionDefinition = {
    id: r.id,
    businessId: r.businessId,
    type: r.type as PromotionType,
    title: r.title,
    code: r.code ?? null,
    percent: r.percent ?? null,
    fixedAmountSom: r.fixedAmountSom ?? null,
    minOrderSom: r.minOrderSom ?? 0,
    giftProductId: r.giftProductId ?? null,
    buyQuantity: r.buyQuantity ?? null,
    getQuantity: r.getQuantity ?? null,
    audienceSegment: (r.audienceSegment ?? null) as CustomerSegment | null,
    startsAt: toIsoOrNull(r.startsAt ?? null),
    endsAt: toIsoOrNull(r.endsAt ?? null),
    active: r.active === true,
    maxRedemptions: r.maxRedemptions ?? 0,
    redemptions: r.redemptions ?? 0,
  };
  return { ...def, status: resolvePromotionStatus(def) };
}

function rowToCampaign(r: any): CampaignRow {
  const def: CampaignDefinition = {
    id: r.id,
    businessId: r.businessId,
    title: r.title,
    promotionId: r.promotionId ?? null,
    audienceSegment: (r.audienceSegment ?? null) as CustomerSegment | null,
    startsAt: toIsoOrNull(r.startsAt ?? null),
    endsAt: toIsoOrNull(r.endsAt ?? null),
    budgetSom: r.budgetSom ?? 0,
    paused: r.paused === true,
    active: r.active === true,
  };
  return { ...def, status: resolveCampaignStatus(def) };
}

// ---------- Promotions ----------

export async function listMerchantPromotions(input: {
  businessId: number;
}): Promise<PromotionRow[]> {
  const rows = await db.merchantPromotion.findMany({
    where: { businessId: input.businessId },
    orderBy: { id: "desc" },
  });
  return (rows as any[]).map(rowToPromotion);
}

export async function createMerchantPromotion(input: {
  businessId: number;
  definition: Partial<PromotionDefinition>;
}): Promise<{ ok: true; promotion: PromotionRow } | { ok: false; error: string }> {
  const d = input.definition;
  const valid = validatePromotionDefinition(d);
  if (!valid.ok) return { ok: false, error: valid.error };
  if (!PROMOTION_TYPES.includes(d.type as PromotionType)) {
    return { ok: false, error: "BAD_TYPE" };
  }

  const code = d.code != null ? normalizePromoCode(d.code) : null;

  const created = await db.merchantPromotion.create({
    data: {
      businessId: input.businessId,
      type: d.type,
      title: String(d.title).trim(),
      code,
      percent: d.percent ?? null,
      fixedAmountSom: d.fixedAmountSom ?? null,
      minOrderSom: Math.max(0, Math.round(Number(d.minOrderSom ?? 0))),
      giftProductId: d.giftProductId ?? null,
      buyQuantity: d.buyQuantity ?? null,
      getQuantity: d.getQuantity ?? null,
      audienceSegment: d.audienceSegment ?? null,
      startsAt: toDateOrNull(d.startsAt),
      endsAt: toDateOrNull(d.endsAt),
      active: d.active === true,
      maxRedemptions: Math.max(0, Math.round(Number(d.maxRedemptions ?? 0))),
      redemptions: 0,
    },
  });

  // Bridge COUPON_PERCENT to the existing Promo table so checkout is unchanged.
  if (created.type === "COUPON_PERCENT" && code != null && d.percent != null) {
    try {
      const maxUses = created.maxRedemptions > 0 ? created.maxRedemptions : 100000;
      await createPromoDb(prisma, input.businessId, code, Number(d.percent), maxUses);
    } catch (e) {
      // If the coupon code already exists in Promo, keep the promotion record;
      // checkout will still honor the existing Promo row.
      console.warn("[createMerchantPromotion] promo mirror skipped:", e);
    }
  }

  return { ok: true, promotion: rowToPromotion(created) };
}

export async function setMerchantPromotionActive(input: {
  businessId: number;
  promotionId: number;
  active: boolean;
}): Promise<{ ok: boolean }> {
  const res = await db.merchantPromotion.updateMany({
    where: { id: input.promotionId, businessId: input.businessId },
    data: { active: input.active },
  });
  return { ok: (res?.count ?? 0) > 0 };
}

export async function deleteMerchantPromotion(input: {
  businessId: number;
  promotionId: number;
}): Promise<{ ok: boolean }> {
  const existing = await db.merchantPromotion.findFirst({
    where: { id: input.promotionId, businessId: input.businessId },
    select: { id: true, type: true, code: true },
  });
  if (existing == null) return { ok: false };
  await db.merchantPromotion.delete({ where: { id: existing.id } });
  if (existing.type === "COUPON_PERCENT" && existing.code) {
    await deletePromoByCodeDb(prisma, input.businessId, existing.code);
  }
  return { ok: true };
}

// ---------- Campaigns ----------

export async function listMerchantCampaigns(input: {
  businessId: number;
}): Promise<CampaignRow[]> {
  const rows = await db.merchantCampaign.findMany({
    where: { businessId: input.businessId },
    orderBy: { id: "desc" },
  });
  return (rows as any[]).map(rowToCampaign);
}

export async function createMerchantCampaign(input: {
  businessId: number;
  definition: Partial<CampaignDefinition>;
}): Promise<{ ok: true; campaign: CampaignRow } | { ok: false; error: string }> {
  const d = input.definition;
  const valid = validateCampaignDefinition(d);
  if (!valid.ok) return { ok: false, error: valid.error };

  const created = await db.merchantCampaign.create({
    data: {
      businessId: input.businessId,
      title: String(d.title).trim(),
      promotionId: d.promotionId ?? null,
      audienceSegment: d.audienceSegment ?? null,
      startsAt: toDateOrNull(d.startsAt),
      endsAt: toDateOrNull(d.endsAt),
      budgetSom: Math.max(0, Math.round(Number(d.budgetSom ?? 0))),
      paused: d.paused === true,
      active: d.active === true,
    },
  });
  return { ok: true, campaign: rowToCampaign(created) };
}

export async function setMerchantCampaignState(input: {
  businessId: number;
  campaignId: number;
  active?: boolean;
  paused?: boolean;
}): Promise<{ ok: boolean }> {
  const data: Record<string, unknown> = {};
  if (typeof input.active === "boolean") data.active = input.active;
  if (typeof input.paused === "boolean") data.paused = input.paused;
  if (Object.keys(data).length === 0) return { ok: false };
  const res = await db.merchantCampaign.updateMany({
    where: { id: input.campaignId, businessId: input.businessId },
    data,
  });
  return { ok: (res?.count ?? 0) > 0 };
}

export async function deleteMerchantCampaign(input: {
  businessId: number;
  campaignId: number;
}): Promise<{ ok: boolean }> {
  const res = await db.merchantCampaign.deleteMany({
    where: { id: input.campaignId, businessId: input.businessId },
  });
  return { ok: (res?.count ?? 0) > 0 };
}

// ---------- Dashboard ----------

export async function buildMarketingDashboard(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MarketingDashboardPayload> {
  const now = new Date();
  const [promotions, campaigns, customerDashboard, analytics] = await Promise.all([
    listMerchantPromotions({ businessId: input.businessId }),
    listMerchantCampaigns({ businessId: input.businessId }),
    buildMerchantCustomerDashboard({ businessId: input.businessId, rangeDays: input.rangeDays }),
    buildMerchantAnalytics({ businessId: input.businessId, rangeDays: input.rangeDays }),
  ]);

  const activePromotions = promotions.filter(
    (p) => resolvePromotionStatus(p, now) === "ACTIVE",
  ).length;
  const activeCampaigns = campaigns.filter(
    (c) => resolveCampaignStatus(c, now) === "ACTIVE",
  ).length;
  const totalRedemptions = promotions.reduce((s, p) => s + p.redemptions, 0);

  const topPromotions = [...promotions]
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 5)
    .map((p) => ({
      id: p.id ?? 0,
      title: p.title,
      type: p.type,
      redemptions: p.redemptions,
    }));

  const segmentCounts = new Map<CustomerSegment | "all", number>();
  for (const c of customerDashboard.topCustomers) {
    for (const seg of c.segments) {
      segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1);
    }
  }
  const topSegments = [...segmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([segment, customers]) => ({ segment, customers }));

  const campaignRoi = campaigns.slice(0, 10).map((c) => ({
    id: c.id ?? 0,
    title: c.title,
    budgetSom: c.budgetSom,
    roi: computeCampaignRoi(0, c.budgetSom),
  }));

  return {
    rangeDays: input.rangeDays,
    activeCampaigns,
    totalCampaigns: campaigns.length,
    activePromotions,
    totalPromotions: promotions.length,
    totalRedemptions,
    customerGrowth: customerDashboard.customerGrowth,
    repeatCustomers: customerDashboard.returningCustomers,
    topPromotions,
    topSegments,
    bestProducts: (analytics.topSku ?? []).slice(0, 5).map((s) => ({
      productId: s.productId,
      name: s.name,
      quantity: s.quantity,
    })),
    campaignRoi,
  };
}
