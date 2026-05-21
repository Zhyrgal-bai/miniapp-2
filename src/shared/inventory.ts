/** Inventory variant key + stock bucket helpers (shared server/client). */

export type StockBuckets = {
  available: number;
  reserved: number;
  paid: number;
  shipped: number;
  returned: number;
};

export type ProductVariantInput = {
  color?: string;
  sizes?: Array<{ size?: string; stock?: number }>;
};

export function inventoryVariantKey(size: string, color: string): string {
  const s = String(size ?? "").trim().toLowerCase();
  const c = String(color ?? "").trim().toLowerCase();
  return `${s}|${c}`;
}

export function parseVariantKey(variantKey: string): { size: string; color: string } {
  const [size = "", color = ""] = String(variantKey).split("|");
  return { size, color };
}

export function totalSellableStock(b: StockBuckets): number {
  return Math.max(0, b.available);
}

export function totalOnHand(b: StockBuckets): number {
  return b.available + b.reserved + b.paid + b.shipped + b.returned;
}

/** Parse variants array from product attributes or API body. */
export function parseProductVariants(raw: unknown): ProductVariantInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => v != null && typeof v === "object") as ProductVariantInput[];
}

export function flattenVariantStockRows(
  variants: ProductVariantInput[]
): Array<{ size: string; color: string; stock: number }> {
  const rows: Array<{ size: string; color: string; stock: number }> = [];
  for (const v of variants) {
    const color = String(v.color ?? "").trim();
    const sizes = Array.isArray(v.sizes) ? v.sizes : [];
    for (const s of sizes) {
      const size = String(s.size ?? "").trim();
      const stock = Math.max(0, Math.round(Number(s.stock ?? 0)));
      rows.push({ size, color, stock });
    }
  }
  return rows;
}

export const LOW_STOCK_THRESHOLD = 3;

export function isLowStock(available: number): boolean {
  return available > 0 && available <= LOW_STOCK_THRESHOLD;
}
