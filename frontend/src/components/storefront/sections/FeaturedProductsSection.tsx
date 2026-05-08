import type { Product } from "../../../types";
import { useTheme } from "../../../context/ThemeContext";
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
}): React.ReactElement | null {
  const { theme } = useTheme();
  const title = readTitle(props.config, "Хиты");
  if (!props.products?.length) return null;

  return (
    <section style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${theme.primaryColor}22`,
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
        />
      </div>
    </section>
  );
}

