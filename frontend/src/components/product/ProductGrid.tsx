import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import { EmptyState } from "../ui/EmptyState";
import "../ui/emptyState.css";
import "../ui/ProductGrid.css";
import { storefrontVerticalExperience } from "../../storefront/verticalExperience";

type ProductGridProps = {
  products: Product[];
  /** Всего товаров в каталоге до фильтра (для пустых состояний). */
  catalogProductCount: number;
  showToast: (msg: string) => void;
  onProductSelect?: (product: Product) => void;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
  businessType?: string;
};

export default function ProductGrid({
  products,
  catalogProductCount,
  showToast,
  onProductSelect,
  cardConfig,
  textConfig,
  kit,
  businessId,
  businessType,
}: ProductGridProps) {
  const readTxt = (k: string, fb: string) => {
    const v = (textConfig as Record<string, unknown> | undefined)?.[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const densityRaw = (cardConfig as Record<string, unknown> | undefined)?.density;
  const density =
    densityRaw === "compact" || densityRaw === "airy" ? (densityRaw as "compact" | "airy") : "normal";

  const catalogLayoutRaw = (cardConfig as Record<string, unknown> | undefined)?.catalogLayout;
  const catalogLayout =
    catalogLayoutRaw === "list" ? "list" : catalogLayoutRaw === "rail" ? "rail" : "grid";

  const verticalExperience = storefrontVerticalExperience(businessType);

  if (catalogProductCount === 0) {
    return (
      <EmptyState
        icon="🛍️"
        title={readTxt("emptyCatalogTitle", "Нет товаров")}
        description={readTxt("emptyCatalogHint", "Скоро появятся товары")}
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        compact
        icon="🔍"
        title={readTxt("emptySearchTitle", "Ничего не найдено")}
        description={readTxt("emptySearchHint", "Смените категорию или поиск")}
      />
    );
  }

  return (
    <div
      data-sf-vertical={verticalExperience !== "default" ? verticalExperience : undefined}
      className={[
        "product-grid",
        `product-grid--density-${density}`,
        catalogLayout === "list" ? "product-grid--list" : "",
        catalogLayout === "rail" ? "product-grid--rail" : "",
        products.length === 1 ? "product-grid--solo" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          showToast={showToast}
          onOpenDetail={onProductSelect}
          cardConfig={cardConfig}
          textConfig={textConfig}
          kit={kit}
          businessId={businessId}
          businessType={businessType}
        />
      ))}
    </div>
  );
}