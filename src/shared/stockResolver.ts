import type { BusinessType } from "@prisma/client";
import { inventoryVariantKey } from "./inventory.js";
import { verticalProfileFor } from "./businessCommerce.js";
import type { PublicProductSize, PublicProductVariant } from "./productDto.js";

export type ProductStockRow = {
  size: string;
  color: string;
  available: number;
};

export type CatalogVariantShape = {
  color: string;
  colorHex?: string | null;
  sizes: Array<{ size: string }>;
};

function normalizeColorField(raw: unknown): { name: string; hex?: string | null } {
  if (raw == null) return { name: "" };
  if (typeof raw === "string") return { name: raw.trim() };
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const name =
      typeof o.name === "string"
        ? o.name.trim()
        : typeof o.color === "string"
          ? o.color.trim()
          : "";
    const hex =
      typeof o.hex === "string"
        ? o.hex
        : typeof o.colorHex === "string"
          ? o.colorHex
          : null;
    return { name, hex };
  }
  return { name: String(raw).trim() };
}

/** Parse variant matrix from attributes (structure + color hex only — stock ignored). */
export function parseCatalogVariantShapes(raw: unknown): CatalogVariantShape[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogVariantShape[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const { name: color, hex: colorHex } = normalizeColorField(r.color);
    const sizesRaw = Array.isArray(r.sizes) ? r.sizes : [];
    const sizes: Array<{ size: string }> = [];
    for (const s of sizesRaw) {
      if (s == null || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const size = String(so.size ?? "").trim();
      if (size !== "") sizes.push({ size });
    }
    if (sizes.length === 0 && color === "") continue;
    out.push({
      color: color || "default",
      colorHex: colorHex ?? null,
      sizes,
    });
  }
  return out;
}

function stockMapFromRows(rows: ProductStockRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const key = inventoryVariantKey(r.size, r.color);
    m.set(key, Math.max(0, Math.round(Number(r.available) || 0)));
  }
  return m;
}

function displayColor(color: string): string {
  const c = String(color ?? "").trim();
  return c === "" ? "default" : c;
}

/** Merge catalog structure with ProductStock.available (single source of truth for sellable qty). */
export function resolvePublicVariants(input: {
  businessType?: BusinessType | null;
  catalogShapes: CatalogVariantShape[];
  stockRows: ProductStockRow[];
}): PublicProductVariant[] {
  const stockMap = stockMapFromRows(input.stockRows);
  const profile = verticalProfileFor(input.businessType ?? null);

  if (input.catalogShapes.length > 0) {
    const out: PublicProductVariant[] = [];
    for (const shape of input.catalogShapes) {
      const color = displayColor(shape.color);
      const sizes: PublicProductSize[] = shape.sizes.map((s) => {
        const key = inventoryVariantKey(s.size, shape.color === "default" ? "" : shape.color);
        const altKey = inventoryVariantKey(s.size, color === "default" ? "" : color);
        const stock = stockMap.get(key) ?? stockMap.get(altKey) ?? 0;
        return { size: s.size, stock };
      });
      if (sizes.length === 0) continue;
      out.push({
        color,
        colorHex: shape.colorHex ?? null,
        sizes,
      });
    }
    if (out.length > 0) return out;
  }

  if (input.stockRows.length > 0) {
    const byColor = new Map<string, PublicProductSize[]>();
    for (const r of input.stockRows) {
      const color = displayColor(r.color);
      const list = byColor.get(color) ?? [];
      list.push({
        size: r.size,
        stock: Math.max(0, Math.round(Number(r.available) || 0)),
      });
      byColor.set(color, list);
    }
    return [...byColor.entries()].map(([color, sizes]) => ({
      color,
      sizes,
    }));
  }

  if (
    profile.inventoryMode !== "metadata_only" &&
    profile.defaultPrimaryValues.length > 0
  ) {
    return [
      {
        color: "default",
        sizes: profile.defaultPrimaryValues.map((size) => ({
          size,
          stock: 0,
        })),
      },
    ];
  }

  return [];
}

export function sumPublicVariantStock(variants: PublicProductVariant[]): number {
  let total = 0;
  for (const v of variants) {
    for (const s of v.sizes) {
      total += Math.max(0, Number(s.stock) || 0);
    }
  }
  return total;
}

export type StockConsistencyIssue = {
  variantKey: string;
  catalogStock: number;
  productStockAvailable: number;
};

/** Compare catalog-declared stock (attributes) vs ProductStock — for logging/validation only. */
export function findStockConsistencyIssues(input: {
  catalogVariantsRaw: unknown;
  stockRows: ProductStockRow[];
}): StockConsistencyIssue[] {
  const issues: StockConsistencyIssue[] = [];
  if (!Array.isArray(input.catalogVariantsRaw)) return issues;

  const stockMap = stockMapFromRows(input.stockRows);

  for (const row of input.catalogVariantsRaw) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const { name: color } = normalizeColorField(r.color);
    const sizesRaw = Array.isArray(r.sizes) ? r.sizes : [];
    for (const s of sizesRaw) {
      if (s == null || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const size = String(so.size ?? "").trim();
      if (size === "") continue;
      const catalogStock = Math.max(0, Math.round(Number(so.stock ?? 0)));
      const key = inventoryVariantKey(size, color);
      const available = stockMap.get(key);
      if (available == null) {
        if (catalogStock > 0) {
          issues.push({
            variantKey: key,
            catalogStock,
            productStockAvailable: 0,
          });
        }
        continue;
      }
      if (catalogStock !== available) {
        issues.push({
          variantKey: key,
          catalogStock,
          productStockAvailable: available,
        });
      }
    }
  }
  return issues;
}
