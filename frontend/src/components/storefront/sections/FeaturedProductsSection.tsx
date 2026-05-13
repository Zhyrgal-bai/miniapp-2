import type { Product } from "../../../types";
import ProductGrid from "../../product/ProductGrid";

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
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
  onOpenProduct?: (product: Product) => void;
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

  return (
    <section className="sf-section sf-section--featured sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div className="sf-section-card sf-section-card--transparent sf-section-card--inset">
        {props.products.length === 0 ? (
          <div className="sf-featured-empty" role="status">
            <p className="sf-featured-empty__title">Нет товаров в категории</p>
            <p className="sf-featured-empty__hint">Выберите другую категорию или «Все»</p>
          </div>
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
          />
        )}
      </div>
    </section>
  );
}

