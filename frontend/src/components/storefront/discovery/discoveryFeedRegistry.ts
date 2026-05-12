import type { Product } from "../../../types";
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

  // Trending: use sold metric if present, else fallback to featured order.
  const trending = [...(ctx.featuredProducts ?? [])].sort(bySoldDesc).slice(0, 12);
  if (trending.length) {
    rails.push({
      id: "trending",
      title: ctx.businessType === "fastfood" ? "Горячее сейчас" : readText("titleTrending", "Trending"),
      layout: ctx.kit === "fashion" ? "editorialStrip" : "horizontalRail",
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
        title: readText("titleHits", "Вы смотрели"),
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
        title: readText("titleHits", "Потому что вы смотрели"),
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
          title: readText("titleHits", "Похожие товары"),
          layout: "horizontalRail",
          products: related,
        });
      }
    }
  }

  return rails;
}

