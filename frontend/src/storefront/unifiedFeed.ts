import type { Product } from "../types";
import {
  buildDiscoveryRails,
  type DiscoveryRail,
  type DiscoveryContext,
} from "../components/storefront/discovery/discoveryFeedRegistry";

export type CommerceFeedBlock =
  | { kind: "primary"; products: Product[]; title: string }
  | { kind: "rail"; rail: DiscoveryRail };

export type UnifiedCommerceFeedInput = DiscoveryContext & {
  textConfig?: Record<string, unknown>;
  primaryTitle?: string;
  primaryProducts?: Product[];
  /** Product IDs already shown in primary grid — excluded from rails. */
  excludeFromRails?: Set<number>;
  coPurchaseIds?: number[];
};

function productKey(p: Product): number {
  return Number(p.id ?? 0);
}

function dedupeRails(
  rails: DiscoveryRail[],
  exclude: Set<number>,
): DiscoveryRail[] {
  const seen = new Set(exclude);
  const out: DiscoveryRail[] = [];
  for (const rail of rails) {
    const products = rail.products.filter((p) => {
      const id = productKey(p);
      if (id <= 0 || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (products.length > 0) {
      out.push({ ...rail, products });
    }
  }
  return out;
}

/** Single discovery feed model: primary catalog block + deduped rails. */
export function buildUnifiedCommerceFeed(
  input: UnifiedCommerceFeedInput,
): CommerceFeedBlock[] {
  const blocks: CommerceFeedBlock[] = [];
  const primary = input.primaryProducts ?? input.featuredProducts ?? [];
  const exclude = new Set(input.excludeFromRails ?? []);
  for (const p of primary) {
    const id = productKey(p);
    if (id > 0) exclude.add(id);
  }

  if (primary.length > 0 || input.primaryTitle) {
    blocks.push({
      kind: "primary",
      products: primary,
      title: input.primaryTitle ?? "Каталог",
    });
  }

  const rails = dedupeRails(
    buildDiscoveryRails({
      kit: input.kit,
      businessType: input.businessType,
      businessId: input.businessId,
      featuredProducts: input.featuredProducts,
      catalogProducts: input.catalogProducts,
      textConfig: input.textConfig,
      coPurchaseIds: input.coPurchaseIds,
    }),
    exclude,
  );

  for (const rail of rails) {
    blocks.push({ kind: "rail", rail });
  }

  return blocks;
}
