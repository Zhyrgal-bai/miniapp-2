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
  const title = readTitle(props.config, "Хиты");
  if (!props.products?.length) return null;

  return (
    <section className="sf-section sf-section--featured" style={{ padding: "var(--sf-section-pad)" }}>
      <div style={{ fontWeight: 800, marginBottom: "var(--sf-space-sm)" }}>{title}</div>
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

