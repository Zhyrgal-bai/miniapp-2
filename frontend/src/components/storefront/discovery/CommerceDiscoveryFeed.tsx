import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { Product } from "../../../types";
import ProductCard from "../../product/ProductCard";
import ProductGrid from "../../product/ProductGrid";
import { buildUnifiedCommerceFeed } from "../../../storefront/unifiedFeed";
import { useCommerceSessionRevision } from "../runtime/useCommerceSessionRevision";
import { fetchStorefrontRecommendations } from "../../../services/storefrontRecommendations";

type Kit = "minimal" | "luxury" | "fashion" | "neon" | "default";

export type CommerceDiscoveryFeedProps = {
  kit: Kit;
  businessType: string;
  businessId: number;
  featuredProducts: Product[];
  primaryProducts: Product[];
  primaryTitle: string;
  catalogProductCount: number;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  catalogProducts: Product[];
  onOpenProduct?: (product: Product) => void;
  /** Embedded inside featured block — tighter rhythm. */
  variant?: "embedded" | "standalone";
  catalogBold?: boolean;
};

function railLayoutClass(layout: string): string {
  switch (layout) {
    case "editorialStrip":
      return "sf-commerce-rail__track sf-commerce-rail__track--editorial";
    case "compactGrid":
    case "marketplaceGrid":
      return "sf-commerce-rail__track sf-commerce-rail__track--grid";
    default:
      return "sf-commerce-rail__track sf-commerce-rail__track--snap";
  }
}

/** Unified commerce discovery stream — primary grid + connected rails. */
export function CommerceDiscoveryFeed(
  props: CommerceDiscoveryFeedProps,
): ReactElement | null {
  const sessionRev = useCommerceSessionRevision(props.businessId);
  const [coPurchaseIds, setCoPurchaseIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchStorefrontRecommendations({
      businessId: props.businessId,
      limit: 12,
    }).then((ids) => {
      if (!cancelled) setCoPurchaseIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [props.businessId]);

  const blocks = useMemo(() => {
    void sessionRev;
    return buildUnifiedCommerceFeed({
        kit: props.kit,
        businessType: props.businessType,
        businessId: props.businessId,
        featuredProducts: props.featuredProducts,
        catalogProducts: props.catalogProducts,
        textConfig: props.textConfig,
        primaryProducts: props.primaryProducts,
        primaryTitle: props.primaryTitle,
      coPurchaseIds,
    });
  }, [
    props.kit,
    props.businessType,
    props.businessId,
    props.featuredProducts,
    props.catalogProducts,
    props.textConfig,
    props.primaryProducts,
    props.primaryTitle,
    coPurchaseIds,
    sessionRev,
  ]);

  if (blocks.length === 0) return null;

  const embedded = props.variant === "embedded";
  const rootClass = [
    "sf-commerce-feed",
    embedded ? "sf-commerce-feed--embedded" : "sf-commerce-feed--standalone",
    props.catalogBold ? "sf-commerce-feed--bold" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} data-sf-commerce-feed>
      {blocks.map((block, idx) => {
        if (block.kind === "primary") {
          if (props.catalogProductCount === 0) return null;
          return (
            <div
              key="primary"
              className="sf-commerce-feed__block sf-commerce-feed__block--primary"
              data-sf-feed-index={idx}
            >
              <h2 className="sf-commerce-feed__title">{block.title}</h2>
              <div className="sf-commerce-feed__grid-wrap">
                {block.products.length === 0 ? (
                  <div className="sf-featured-empty" role="status">
                    <p className="sf-featured-empty__title">Нет товаров в категории</p>
                    <p className="sf-featured-empty__hint">
                      Выберите другую категорию или «Все»
                    </p>
                  </div>
                ) : (
                  <ProductGrid
                    products={block.products}
                    catalogProductCount={props.catalogProductCount}
                    showToast={() => undefined}
                    onProductSelect={props.onOpenProduct}
                    cardConfig={props.cardConfig}
                    textConfig={props.textConfig}
                    kit={props.kit}
                    businessId={props.businessId}
                    businessType={props.businessType}
                  />
                )}
              </div>
            </div>
          );
        }

        const { rail } = block;
        return (
          <div
            key={rail.id}
            className="sf-commerce-feed__block sf-commerce-feed__block--rail"
            data-sf-feed-index={idx}
            data-sf-rail={rail.id}
          >
            <h3 className="sf-commerce-feed__rail-title">{rail.title}</h3>
            <div className={railLayoutClass(rail.layout)} role="list">
              {rail.products.map((p) => (
                <div
                  key={String(p.id)}
                  className="sf-commerce-rail__item"
                  role="listitem"
                >
                  <ProductCard
                    product={p}
                    showToast={() => undefined}
                    onOpenDetail={props.onOpenProduct}
                    cardConfig={props.cardConfig}
                    textConfig={props.textConfig}
                    kit={props.kit}
                    businessId={props.businessId}
                    businessType={props.businessType}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
