import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { Product } from "../../../types";
import ProductCard from "../../product/ProductCard";
import ProductGrid from "../../product/ProductGrid";
import { buildUnifiedCommerceFeed } from "../../../storefront/unifiedFeed";
import { useCommerceSessionRevision } from "../runtime/useCommerceSessionRevision";
import { fetchStorefrontRecommendations } from "../../../services/storefrontRecommendations";
import { EmptyState } from "../../ui/EmptyState";
import { ProductCardSkeleton } from "../../ui/Skeleton";

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
  searchQuery?: string;
  catalogLoading?: boolean;
  onClearFilters?: () => void;
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

function readTxt(cfg: Record<string, unknown> | undefined, key: string, fb: string): string {
  const v = cfg?.[key];
  return typeof v === "string" && v.trim() !== "" ? v : fb;
}

/** Unified commerce discovery stream — primary grid + connected rails. */
export function CommerceDiscoveryFeed(
  props: CommerceDiscoveryFeedProps,
): ReactElement | null {
  const sessionRev = useCommerceSessionRevision(props.businessId);
  const [coPurchaseIds, setCoPurchaseIds] = useState<number[]>([]);
  const searchActive = (props.searchQuery ?? "").trim() !== "";

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

  const rails = blocks.filter((b) => b.kind === "rail");
  const hasRails = rails.length > 0;
  const showRecommendationsHint = !searchActive && props.primaryProducts.length === 0 && hasRails;

  if (props.catalogProductCount === 0 && !props.catalogLoading) {
    return (
      <section className="sf-commerce-feed sf-commerce-feed--standalone" data-sf-commerce-feed>
        <EmptyState
          icon="🛍️"
          title={readTxt(props.textConfig, "emptyCatalogTitle", "Нет товаров")}
          description={readTxt(props.textConfig, "emptyCatalogHint", "Скоро появятся новые позиции в каталоге")}
        />
      </section>
    );
  }

  if (blocks.length === 0 && !props.catalogLoading) return null;

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
      {showRecommendationsHint ? (
        <p className="sf-commerce-feed__hint" role="status">
          Подборка для вас
        </p>
      ) : null}
      {blocks.map((block, idx) => {
        if (block.kind === "primary") {
          return (
            <div
              key="primary"
              className="sf-commerce-feed__block sf-commerce-feed__block--primary"
              data-sf-feed-index={idx}
            >
              <h2 className="sf-commerce-feed__title">{block.title}</h2>
              <div className="sf-commerce-feed__grid-wrap">
                {props.catalogLoading ? (
                  <div className="sf-commerce-feed__skeleton-grid" aria-busy="true" aria-label="Загрузка товаров">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : block.products.length === 0 ? (
                  searchActive ? (
                    <EmptyState
                      compact
                      icon="🔍"
                      title={readTxt(props.textConfig, "emptySearchTitle", "Ничего не найдено")}
                      description={readTxt(
                        props.textConfig,
                        "emptySearchHint",
                        "Попробуйте другой запрос или посмотрите рекомендации ниже",
                      )}
                      actionLabel="Сбросить поиск"
                      onAction={props.onClearFilters}
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon="🏷️"
                      title="Нет товаров в категории"
                      description="Выберите другую категорию или «Все»"
                      actionLabel="Показать все"
                      onAction={props.onClearFilters}
                    />
                  )
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
      {props.catalogLoading && blocks.every((b) => b.kind === "rail") ? (
        <div className="sf-commerce-feed__skeleton-grid" aria-busy="true" aria-label="Загрузка каталога">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
