import type { Product } from "../../../types";
import type { ReactNode } from "react";
import ProductGrid from "../../product/ProductGrid";
import { EmptyState } from "../../ui/EmptyState";
import "../../ui/emptyState.css";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export function FeaturedProductsSection(props: {
  config: Record<string, unknown>;
  products: Product[];
  /** Для фильтра категорий: полное число товаров до фильтра (пустое состояние «в этой категории»). */
  catalogProductCount?: number;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  storefrontStyleConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
  businessType?: string;
  onOpenProduct?: (product: Product) => void;
  /** Сразу под сеткой (например ленты discovery) — внутри той же секции и паддингов. */
  afterGrid?: ReactNode;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleHits === "string" && String(props.textConfig.titleHits).trim() !== ""
      ? String(props.textConfig.titleHits)
      : "Хиты";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const fullCount =
    typeof props.catalogProductCount === "number" ? props.catalogProductCount : props.products.length;
  if (fullCount === 0) return null;

  const catalogBold =
    props.storefrontStyleConfig != null &&
    typeof props.storefrontStyleConfig.catalog === "object" &&
    props.storefrontStyleConfig.catalog !== null &&
    (props.storefrontStyleConfig.catalog as { gridBoost?: string }).gridBoost !== "normal";

  return (
    <section
      className={`sf-section sf-section--featured sf-section--padded${catalogBold ? " sf-section--catalog-bold" : ""}${props.afterGrid != null ? " sf-section--with-discovery" : ""}`}
    >
      <div className="sf-section__title">{title}</div>
      <div className="sf-section-card sf-section-card--transparent sf-section-card--inset">
        {props.products.length === 0 ? (
          <EmptyState
            compact
            icon="🏷️"
            title="Нет товаров в категории"
            description="Выберите другую категорию или «Все»"
          />
        ) : (
          <ProductGrid
            products={props.products}
            catalogProductCount={fullCount}
            showToast={() => undefined}
            onProductSelect={props.onOpenProduct}
            cardConfig={props.cardConfig}
            textConfig={props.textConfig}
            kit={props.kit}
            businessId={props.businessId}
            businessType={props.businessType}
          />
        )}
        {props.afterGrid != null ? props.afterGrid : null}
      </div>
    </section>
  );
}

