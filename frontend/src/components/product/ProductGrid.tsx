import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import "../ui/ProductGrid.css";

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
}: ProductGridProps) {
  const readTxt = (k: string, fb: string) => {
    const v = (textConfig as Record<string, unknown> | undefined)?.[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };
  if (catalogProductCount === 0) {
    return (
      <div className="product-grid product-grid--empty" role="status">
        <p className="product-grid__empty-title">{readTxt("emptyCatalogTitle", "Нет товаров")}</p>
        <p className="product-grid__empty-hint">{readTxt("emptyCatalogHint", "Скоро появятся товары")}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-grid product-grid--empty" role="status">
        <p className="product-grid__empty-title">{readTxt("emptySearchTitle", "Ничего не найдено")}</p>
        <p className="product-grid__empty-hint">{readTxt("emptySearchHint", "Смените категорию или поиск")}</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
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
        />
      ))}
    </div>
  );
}