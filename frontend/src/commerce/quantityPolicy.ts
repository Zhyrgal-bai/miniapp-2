import type { Product, Size } from "../types";
import {
  getNormalizedVariants,
  isOutOfStock,
  productDisplayDefaults,
} from "../utils/product";

/**
 * Размеры для строки корзины (productId + color + size) — та же логика, что у карточки товара:
 * плоские `sizes`, иначе вариант по цвету, иначе нормализованные варианты с fallback.
 */
export function getSizesForCartLine(product: Product, color: string): Size[] {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes;
  }
  if (product.variants && product.variants.length > 0) {
    const v =
      product.variants.find((x) => x.color === color) ?? product.variants[0];
    if (v?.sizes?.length) return v.sizes;
    return [];
  }
  const nv = getNormalizedVariants(product);
  const v = nv.find((x) => x.color === color) ?? nv[0];
  if (v?.sizes?.length) return v.sizes;
  return [
    {
      size: productDisplayDefaults.DEFAULT_SIZE_LABEL,
      stock: productDisplayDefaults.DEFAULT_SIZE_STOCK,
    },
  ];
}

/** Максимум единиц для строки корзины (остаток выбранного размера в выбранном цвете). */
export function getMaxOrderQty(
  product: Product,
  size: string,
  color: string
): number {
  if (isOutOfStock(product)) return 0;
  const sizes = getSizesForCartLine(product, color);
  const row = sizes.find((s) => s.size === size);
  return row ? Math.max(0, Math.floor(Number(row.stock) || 0)) : 0;
}

export function capCartQuantity(
  product: Product,
  size: string,
  color: string,
  qty: number
): number {
  const max = getMaxOrderQty(product, size, color);
  return Math.min(Math.max(0, qty), max);
}
