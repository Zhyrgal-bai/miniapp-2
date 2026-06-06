import type { Product } from "../types";
import { getNormalizedVariants, isOutOfStock } from "../utils/product";
import { verticalUsesColorAxis } from "@repo-shared/businessCommerce";

function uniqueSizes(product: Product): string[] {
  const set = new Set<string>();
  if (product.sizes?.length) {
    for (const s of product.sizes) {
      const name = String(s.size ?? "").trim();
      if (name) set.add(name);
    }
  }
  for (const v of getNormalizedVariants(product)) {
    for (const s of v.sizes ?? []) {
      const name = String(s.size ?? "").trim();
      if (name) set.add(name);
    }
  }
  return [...set];
}

function uniqueColors(
  product: Product,
  businessType?: string | null,
  merchantConfig?: Record<string, unknown> | null,
): string[] {
  if (!verticalUsesColorAxis(businessType ?? product.businessType, merchantConfig)) return [];
  const set = new Set<string>();
  if (product.colors?.length) {
    for (const c of product.colors) {
      const name = String(c.name ?? "").trim();
      if (name && name !== "default") set.add(name);
    }
  }
  for (const v of getNormalizedVariants(product)) {
    const name = String(v.color ?? "").trim();
    if (name && name !== "default") set.add(name);
  }
  return [...set];
}

/** True when user must pick size/color/options before add (e.g. clothing). */
export function productRequiresVariantPicker(
  product: Product,
  businessType?: string | null,
  merchantConfig?: Record<string, unknown> | null,
): boolean {
  if (isOutOfStock(product)) return false;
  const sizes = uniqueSizes(product);
  const colors = uniqueColors(product, businessType, merchantConfig);
  if (colors.length > 1) return true;
  if (sizes.length > 1) return true;
  return false;
}

/** First in-stock line for one-tap add from catalog card. */
export function resolveInstantAddLine(
  product: Product,
  businessType?: string | null,
  merchantConfig?: Record<string, unknown> | null,
): { size: string; color: string } | null {
  if (productRequiresVariantPicker(product, businessType, merchantConfig)) return null;
  const variants = getNormalizedVariants(product);
  if (variants.length === 0) {
    return { size: "default", color: "default" };
  }
  for (const v of variants) {
    for (const s of v.sizes ?? []) {
      if ((s.stock ?? 0) > 0) {
        return { size: s.size, color: v.color ?? "default" };
      }
    }
  }
  const v0 = variants[0];
  return {
    size: v0?.sizes?.[0]?.size ?? "default",
    color: v0?.color ?? "default",
  };
}
