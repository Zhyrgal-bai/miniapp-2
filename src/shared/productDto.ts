import type { BusinessType } from "@prisma/client";
import {
  findStockConsistencyIssues,
  parseCatalogVariantShapes,
  resolvePublicVariants,
  sumPublicVariantStock,
  type ProductStockRow,
} from "./stockResolver.js";

export type PublicProductSize = {
  size: string;
  stock: number;
};

export type PublicProductVariant = {
  color: string;
  colorHex?: string | null;
  sizes: PublicProductSize[];
};

export type PublicProduct = {
  id: number;
  name: string;
  price: number;
  image: string;
  images?: string[];
  description?: string | null;
  categoryId?: number | null;
  discountPercent?: number | null;
  attributes?: Record<string, unknown>;
  variants: PublicProductVariant[];
  totalAvailable: number;
  businessType?: BusinessType | null;
};

type DbProductLike = {
  id: number;
  name: string;
  price: number;
  image: string | null;
  images?: unknown;
  description?: string | null;
  categoryId?: number | null;
  discountPercent?: number | null;
  attributes?: unknown;
};

export type ToPublicProductOptions = {
  businessType?: BusinessType | null;
  /** ProductStock rows — sole source of sellable quantities. */
  stockRows?: ProductStockRow[];
};

function stripVariantsFromAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...attributes };
  delete out.variants;
  delete out.simpleStock;
  return out;
}

/** Normalize DB/API product → storefront DTO; stock always from ProductStock. */
export function toPublicProduct(
  raw: DbProductLike,
  opts?: BusinessType | null | ToPublicProductOptions,
): PublicProduct {
  const options: ToPublicProductOptions =
    opts != null && typeof opts === "object" && "stockRows" in opts
      ? opts
      : { businessType: (opts as BusinessType | null | undefined) ?? null };

  const businessType = options.businessType ?? null;
  const stockRows = options.stockRows ?? [];

  const attrs =
    raw.attributes != null &&
    typeof raw.attributes === "object" &&
    !Array.isArray(raw.attributes)
      ? (raw.attributes as Record<string, unknown>)
      : {};

  const catalogShapes = parseCatalogVariantShapes(attrs.variants);

  const variants = resolvePublicVariants({
    businessType,
    catalogShapes,
    stockRows,
  });

  const images = Array.isArray(raw.images)
    ? raw.images.filter((u): u is string => typeof u === "string" && u.trim() !== "")
    : undefined;

  const totalAvailable = sumPublicVariantStock(variants);

  return {
    id: raw.id,
    name: raw.name,
    price: raw.price,
    image: raw.image ?? "",
    ...(images && images.length > 0 ? { images } : {}),
    description: raw.description ?? null,
    categoryId: raw.categoryId ?? null,
    discountPercent: raw.discountPercent ?? null,
    attributes: stripVariantsFromAttributes(attrs),
    variants,
    totalAvailable,
    businessType,
  };
}

export function normalizeVariantsForSave(raw: unknown): Array<{
  color: string;
  sizes: Array<{ size: string; stock: number }>;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    color: string;
    sizes: Array<{ size: string; stock: number }>;
  }> = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let color = "";
    const c = r.color;
    if (typeof c === "string") color = c.trim();
    else if (c != null && typeof c === "object" && !Array.isArray(c)) {
      const co = c as Record<string, unknown>;
      color = typeof co.name === "string" ? co.name.trim() : "";
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
    out.push({ color: color === "default" ? "" : color, sizes });
  }
  return out;
}

export { findStockConsistencyIssues, parseCatalogVariantShapes };
