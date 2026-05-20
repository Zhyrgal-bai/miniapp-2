import type { BusinessType } from "@prisma/client";
import { prisma } from "./db.js";

export type PublicStoreCard = {
  slug: string;
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  businessType: string;
  featured: boolean;
  openPath: string;
};

/** Upsert marketplace listing when merchant publishes storefront. */
export async function syncPlatformStoreListing(businessId: number): Promise<void> {
  const bid = businessId;
  const b = await prisma.business.findUnique({
    where: { id: bid },
    select: {
      id: true,
      name: true,
      slug: true,
      businessType: true,
      isActive: true,
      isBlocked: true,
      storefrontPublishedAt: true,
      themeConfig: true,
      settings: { select: { logoUrl: true } },
    },
  });
  if (!b || b.isBlocked || !b.isActive || !b.storefrontPublishedAt) {
    await prisma.platformStoreListing.deleteMany({ where: { businessId: bid } }).catch(() => undefined);
    return;
  }

  const slug = (b.slug ?? `shop-${bid}`).trim().toLowerCase();
  const theme = (b.themeConfig ?? {}) as Record<string, unknown>;
  const tagline =
    typeof theme.tagline === "string" && theme.tagline.trim() !== ""
      ? theme.tagline.trim().slice(0, 160)
      : null;
  const logoUrl = b.settings?.logoUrl?.trim() ?? null;

  await prisma.platformStoreListing.upsert({
    where: { businessId: bid },
    create: {
      businessId: bid,
      slug,
      displayName: b.name.slice(0, 120),
      tagline,
      logoUrl,
      businessType: b.businessType,
      isPublic: false,
      publishedAt: b.storefrontPublishedAt,
    },
    update: {
      slug,
      displayName: b.name.slice(0, 120),
      tagline,
      logoUrl,
      businessType: b.businessType,
      publishedAt: b.storefrontPublishedAt,
      delistedAt: null,
    },
  });
}

export async function setStoreListingVisibility(input: {
  businessId: number;
  isPublic: boolean;
}): Promise<void> {
  await prisma.platformStoreListing.updateMany({
    where: { businessId: input.businessId },
    data: { isPublic: input.isPublic },
  });
}

export async function listDiscoverStores(input: {
  featured?: boolean;
  businessType?: BusinessType;
  q?: string;
  limit?: number;
}): Promise<PublicStoreCard[]> {
  const take = Math.min(Math.max(input.limit ?? 24, 1), 48);
  const where: {
    isPublic: boolean;
    delistedAt: null;
    isFeatured?: boolean;
    businessType?: BusinessType;
    OR?: Array<{ displayName?: { contains: string; mode: "insensitive" }; slug?: { contains: string; mode: "insensitive" } }>;
  } = {
    isPublic: true,
    delistedAt: null,
  };
  if (input.featured) where.isFeatured = true;
  if (input.businessType) where.businessType = input.businessType;
  const q = input.q?.trim();
  if (q && q.length >= 2) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.platformStoreListing.findMany({
    where,
    orderBy: [
      { isFeatured: "desc" },
      { featuredRank: "asc" },
      { trendScore: "desc" },
      { publishedAt: "desc" },
    ],
    take,
  });

  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    tagline: r.tagline,
    logoUrl: r.logoUrl,
    businessType: r.businessType,
    featured: r.isFeatured,
    openPath: `/s/${encodeURIComponent(r.slug)}`,
  }));
}

export async function getDiscoverStoreBySlug(
  slug: string,
): Promise<PublicStoreCard | null> {
  const s = slug.trim().toLowerCase();
  if (s === "") return null;
  const r = await prisma.platformStoreListing.findFirst({
    where: { slug: s, isPublic: true, delistedAt: null },
  });
  if (!r) return null;
  return {
    slug: r.slug,
    displayName: r.displayName,
    tagline: r.tagline,
    logoUrl: r.logoUrl,
    businessType: r.businessType,
    featured: r.isFeatured,
    openPath: `/s/${encodeURIComponent(r.slug)}`,
  };
}

/** Recompute trendScore from storefront events (last 7 days store views). */
export async function refreshDiscoverTrendScores(): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400000);
  const grouped = await prisma.storefrontEvent.groupBy({
    by: ["businessId"],
    where: {
      eventType: "STORE_VIEW",
      createdAt: { gte: since },
    },
    _count: { businessId: true },
  });
  let updated = 0;
  for (const g of grouped) {
    const score = g._count.businessId;
    const r = await prisma.platformStoreListing.updateMany({
      where: { businessId: g.businessId },
      data: { trendScore: score },
    });
    updated += r.count;
  }
  return updated;
}
