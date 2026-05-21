import type { Product, Variant } from "../types";

function variantsFromAttributes(product: Product): Variant[] {
  const attrs = product.attributes;
  if (attrs == null || typeof attrs !== "object" || Array.isArray(attrs)) {
    return [];
  }
  const raw = (attrs as Record<string, unknown>).variants;
  if (!Array.isArray(raw)) return [];
  const out: Variant[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let color = "";
    let colorHex: string | null = null;
    const c = r.color;
    if (typeof c === "string") color = c.trim();
    else if (c != null && typeof c === "object" && !Array.isArray(c)) {
      const co = c as Record<string, unknown>;
      color = typeof co.name === "string" ? co.name.trim() : "";
      colorHex = typeof co.hex === "string" ? co.hex : null;
    }
    const sizesRaw = Array.isArray(r.sizes) ? r.sizes : [];
    const sizes = sizesRaw
      .map((s) => {
        if (s == null || typeof s !== "object") return null;
        const so = s as Record<string, unknown>;
        const size = String(so.size ?? "").trim();
        if (size === "") return null;
        return {
          size,
          stock: Math.max(0, Math.round(Number(so.stock ?? 0))),
        };
      })
      .filter((x): x is { size: string; stock: number } => x != null);
    if (sizes.length === 0) continue;
    out.push({
      color: color || "default",
      ...(colorHex ? { colorHex } : {}),
      sizes,
    });
  }
  return out;
}

export function getDiscountPercent(product: Product): number {
  const d = product.discountPercent;
  if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(Number(d))));
}

export function getEffectivePrice(product: Product): number {
  const base = Number(product.price);
  if (!Number.isFinite(base) || base < 0) return 0;
  const pct = getDiscountPercent(product);
  if (pct <= 0) return Math.round(base);
  return Math.max(0, Math.round((base * (100 - pct)) / 100));
}

export function getProductImages(product: Product): string[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return [product.image];
}

export function getPrimaryImage(product: Product): string {
  return getProductImages(product)[0] ?? product.image;
}

function cloneSizes(
  sizes: { size: string; stock: number }[],
): { size: string; stock: number }[] {
  return sizes.map((s) => ({ size: s.size, stock: s.stock }));
}

export function getNormalizedVariants(product: Product): Variant[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants;
  }
  const fromAttrs = variantsFromAttributes(product);
  if (fromAttrs.length > 0) return fromAttrs;
  if (product.sizes && product.sizes.length > 0) {
    return [{ color: "default", sizes: cloneSizes(product.sizes) }];
  }
  return [];
}

function sumStockOfSizes(sizes: { stock: number }[]): number {
  return sizes.reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
}

export function getTotalStockSum(product: Product): number {
  if (typeof product.totalAvailable === "number") {
    return Math.max(0, product.totalAvailable);
  }
  if (product.sizes && product.sizes.length > 0) {
    return sumStockOfSizes(product.sizes);
  }
  const variants = getNormalizedVariants(product);
  if (variants.length > 0) {
    return variants.reduce(
      (acc, v) => acc + sumStockOfSizes(v.sizes ?? []),
      0,
    );
  }
  return 0;
}

export function getTotalStock(product: Product): number {
  return getTotalStockSum(product);
}

export function isOutOfStock(product: Product): boolean {
  return getTotalStock(product) <= 0;
}

export function getLineStock(
  product: Product,
  size: string,
  color: string,
): number {
  const variants = getNormalizedVariants(product);
  const colorKey = color.trim() || "default";
  const variant =
    variants.find((v) => v.color === colorKey) ??
    variants.find((v) => v.color === "default") ??
    variants[0];
  if (!variant?.sizes?.length) return 0;
  const row = variant.sizes.find((s) => s.size === size);
  return row ? Math.max(0, Number(row.stock) || 0) : 0;
}
