import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import "../ui/ProductGrid.css";

type ProductGridProps = {
  products: Product[];
  /** Всего товаров в каталоге до фильтра (для пустых состояний). */
  catalogProductCount: number;
  showToast: (msg: string) => void;
  onProductSelect?: (product: Product) => void;
};

export default function ProductGrid({
  products,
  catalogProductCount,
  showToast,
  onProductSelect,
}: ProductGridProps) {
  if (catalogProductCount === 0) {
    return (
      <div className="product-grid product-grid--empty" role="status">
        <p className="product-grid__empty-title">Скоро появятся товары 🔥</p>
        <p className="product-grid__empty-hint">Загляните позже</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-grid product-grid--empty" role="status">
        <p className="product-grid__empty-title">Ничего не найдено</p>
        <p className="product-grid__empty-hint">Смените категорию или поиск</p>
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
        />
      ))}
    </div>
  );
}