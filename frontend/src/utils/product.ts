import type { Product, Variant } from "../types";

const DEFAULT_SIZE_STOCK = 10;

/** Скидка 0–100 с поля товара. */
export function getDiscountPercent(product: Product): number {
  const d = product.discountPercent;
  if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(Number(d))));
}

/** Цена со скидкой (целые сомы), без изменения `price` в БД. */
export function getEffectivePrice(product: Product): number {
  const base = Number(product.price);
  if (!Number.isFinite(base) || base < 0) return 0;
  const pct = getDiscountPercent(product);
  if (pct <= 0) return Math.round(base);
  return Math.max(0, Math.round((base * (100 - pct)) / 100));
}

const DEFAULT_SIZE_LABEL = "M";
const DEFAULT_COLOR_NAME = "Белый";
const DEFAULT_COLOR_HEX = "#ffffff";

/** Список изображений: `images` или одно поле `image`. */
export function getProductImages(product: Product): string[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return [product.image];
}

/** Первое изображение для превью. */
export function getPrimaryImage(product: Product): string {
  return getProductImages(product)[0] ?? product.image;
}

function cloneSizes(
  sizes: { size: string; stock: number }[]
): { size: string; stock: number }[] {
  return sizes.map((s) => ({ size: s.size, stock: s.stock }));
}

/**
 * Варианты для UI/корзины: старый `variants` или сборка из `colors` + `sizes` с fallback.
 */
export function getNormalizedVariants(product: Product): Variant[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants;
  }

  const sizes =
    product.sizes && product.sizes.length > 0
      ? cloneSizes(product.sizes)
      : [{ size: DEFAULT_SIZE_LABEL, stock: DEFAULT_SIZE_STOCK }];

  if (product.colors && product.colors.length > 0) {
    return product.colors.map((c) => ({
      color: c.name,
      colorHex: c.hex,
      sizes: cloneSizes(sizes),
    }));
  }

  return [
    {
      color: DEFAULT_COLOR_NAME,
      colorHex: DEFAULT_COLOR_HEX,
      sizes: cloneSizes(sizes),
    },
  ];
}

function sumStockOfSizes(sizes: { stock: number }[]): number {
  return sizes.reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
}

/** Сумма `stock` по всем размерам без fallback (удобно для админки / аналитики). */
export function getTotalStockSum(product: Product): number {
  if (product.sizes && product.sizes.length > 0) {
    return sumStockOfSizes(product.sizes);
  }

  if (product.variants && product.variants.length > 0) {
    return product.variants.reduce(
      (acc, v) => acc + sumStockOfSizes(v.sizes ?? []),
      0
    );
  }

  return 0;
}

/** Сумма остатков по всем размерам (плоская модель или сумма по вариантам). */
export function getTotalStock(product: Product): number {
  const sum = getTotalStockSum(product);
  if (sum > 0) return sum;
  if (product.sizes?.length || product.variants?.length) return 0;
  return DEFAULT_SIZE_STOCK;
}

export function isOutOfStock(product: Product): boolean {
  return getTotalStock(product) === 0;
}

export const productDisplayDefaults = {
  DEFAULT_SIZE_STOCK,
  DEFAULT_SIZE_LABEL,
  DEFAULT_COLOR_NAME,
  DEFAULT_COLOR_HEX,
} as const;
