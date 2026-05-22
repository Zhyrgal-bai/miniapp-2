/** Server/client pricing helpers — discount lives in attributes JSON, not a Product column. */

export function discountPercentFromAttributes(
  attributes: unknown,
): number {
  if (
    attributes == null ||
    typeof attributes !== "object" ||
    Array.isArray(attributes)
  ) {
    return 0;
  }
  const d = (attributes as Record<string, unknown>).discountPercent;
  if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(Number(d))));
}

export function effectiveUnitPriceFromProduct(input: {
  price: number;
  attributes?: unknown;
}): number {
  const base = Number(input.price);
  if (!Number.isFinite(base) || base < 0) return 0;
  const pct = discountPercentFromAttributes(input.attributes);
  if (pct <= 0) return Math.round(base);
  return Math.max(0, Math.round((base * (100 - pct)) / 100));
}
