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
    <section className="sf-section sf-section--featured" style={{ padding: "var(--sf-section-pad)" }}>
      <div className="sf-section__title">{title}</div>
      <div
        style={{
          borderRadius: "var(--sf-section-radius)",
          border: "1px solid var(--sf-color-border)",
          background: "transparent",
          padding: 6,
        }}
      >
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

