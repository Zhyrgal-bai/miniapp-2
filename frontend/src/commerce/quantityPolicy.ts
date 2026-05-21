import type { Product, Size } from "../types";
import { getLineStock, getNormalizedVariants, isOutOfStock } from "../utils/product";

export function getSizesForCartLine(product: Product, color: string): Size[] {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes;
  }
  const nv = getNormalizedVariants(product);
  const colorKey = color.trim() || "default";
  const v =
    nv.find((x) => x.color === colorKey) ??
    nv.find((x) => x.color === "default") ??
    nv[0];
  return v?.sizes ?? [];
}

export function getMaxOrderQty(
  product: Product,
  size: string,
  color: string,
): number {
  if (isOutOfStock(product)) return 0;
  return getLineStock(product, size, color);
}

export function capCartQuantity(
  product: Product,
  size: string,
  color: string,
  qty: number,
): number {
  const max = getMaxOrderQty(product, size, color);
  return Math.min(Math.max(0, qty), max);
}
