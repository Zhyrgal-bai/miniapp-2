import type { Product } from "../../../types";
import ProductGrid from "../../product/ProductGrid";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export function FeaturedProductsSection(props: {
  config: Record<string, unknown>;
  products: Product[];
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleHits === "string" && String(props.textConfig.titleHits).trim() !== ""
      ? String(props.textConfig.titleHits)
      : "Хиты";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  if (!props.products?.length) return null;

  return (
    <section className="sf-section sf-section--featured sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div className="sf-section-card sf-section-card--transparent sf-section-card--inset">
        <ProductGrid
          products={props.products}
          catalogProductCount={props.products.length}
          showToast={() => undefined}
          onProductSelect={() => undefined}
          cardConfig={props.cardConfig}
          textConfig={props.textConfig}
          kit={props.kit}
          businessId={props.businessId}
        />
      </div>
    </section>
  );
}

