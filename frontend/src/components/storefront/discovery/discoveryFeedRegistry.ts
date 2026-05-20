import type { Product } from "../../../types";
import { ru } from "../../../i18n/ru";
import { getRecentlyViewedIds } from "./recentlyViewed";
import { categoryAffinities } from "../runtime/commerceSession";

export type DiscoveryLayoutId =
  | "horizontalRail"
  | "compactGrid"
  | "editorialStrip"
  | "marketplaceGrid";

export type DiscoveryRail = {
  id: string;
  title: string;
  layout: DiscoveryLayoutId;
  products: Product[];
};

export type DiscoveryContext = {
  kit: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessType: string;
  businessId: number;
  featuredProducts: Product[];
  catalogProducts: Product[];
  /** Server co-purchase product IDs (optional). */
  coPurchaseIds?: number[];
};

function bySoldDesc(a: Product, b: Product): number {
  const sa = Number(a.sold ?? 0) || 0;
  const sb = Number(b.sold ?? 0) || 0;
  return sb - sa;
}

export function buildDiscoveryRails(ctx: DiscoveryContext & { textConfig?: Record<string, unknown> }): DiscoveryRail[] {
  const rails: DiscoveryRail[] = [];
  const affinities = categoryAffinities(ctx.businessId);
  const txt = ctx.textConfig ?? {};
  const readText = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  // Co-purchase rail from server recommendations.
  const coIds = ctx.coPurchaseIds ?? [];
  if (coIds.length >= 2) {
    const byId = new Map(ctx.catalogProducts.map((p) => [Number(p.id ?? 0), p] as const));
    const bought = coIds
      .map((id) => byId.get(id))
      .filter(Boolean) as Product[];
    if (bought.length >= 2) {
      rails.push({
        id: "bought_together",
        title: readText("titleBoughtTogether", ru.discovery.titleBoughtTogether),
        layout: "horizontalRail",
        products: bought.slice(0, 12),
      });
    }
  }

  // Trending: prefer full catalog bestsellers; fallback to featured.
  const trendingPool =
    (ctx.catalogProducts?.length ?? 0) >= 4
      ? ctx.catalogProducts
      : ctx.featuredProducts ?? [];
  const trending = [...trendingPool].sort(bySoldDesc).slice(0, 12);
  if (trending.length) {
    rails.push({
      id: "trending",
      title:
        ctx.businessType === "fastfood"
          ? ru.discovery.titleHotNow
          : readText("titleTrending", ru.discovery.titleTrending),
      layout: ctx.kit === "fashion" ? "editorialStrip" : "marketplaceGrid",
      products: trending,
    });
  }

  // Recently viewed: session-scoped.
  const recentIds = getRecentlyViewedIds(ctx.businessId);
  if (recentIds.length) {
    const byId = new Map(ctx.catalogProducts.map((p) => [Number(p.id ?? 0), p] as const));
    const recent = recentIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
    if (recent.length) {
      rails.push({
        id: "recent",
        title: readText("titleRecentlyViewed", ru.discovery.titleRecentlyViewed),
        layout: "horizontalRail",
        products: recent.slice(0, 12),
      });
    }
  }

  // Because you viewed: use top category affinity, exclude recently viewed.
  const topCat = [...affinities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (topCat) {
    const exclude = new Set(recentIds);
    const because = ctx.catalogProducts
      .filter((p) => Number(p.categoryId) === topCat && !exclude.has(Number(p.id ?? 0)))
      .sort(bySoldDesc)
      .slice(0, 12);
    if (because.length) {
      rails.push({
        id: "because_viewed",
        title: readText("titleBecauseViewed", ru.discovery.titleBecauseViewed),
        layout: ctx.kit === "fashion" ? "editorialStrip" : "horizontalRail",
        products: because,
      });
    }
  }

  // Related products: use last viewed product's category (fallback to topCat).
  const lastViewed = recentIds[0] ?? null;
  if (lastViewed) {
    const byId = new Map(ctx.catalogProducts.map((p) => [Number(p.id ?? 0), p] as const));
    const seed = byId.get(lastViewed);
    const seedCat = seed?.categoryId ?? topCat;
    if (seedCat) {
      const exclude = new Set(recentIds);
      const related = ctx.catalogProducts
        .filter((p) => Number(p.categoryId) === Number(seedCat) && !exclude.has(Number(p.id ?? 0)))
        .sort(bySoldDesc)
        .slice(0, 12);
      if (related.length) {
        rails.push({
          id: "related",
          title: readText("titleRelated", ru.discovery.titleRelated),
          layout: "horizontalRail",
          products: related,
        });
      }
    }
  }

  return rails;
}

