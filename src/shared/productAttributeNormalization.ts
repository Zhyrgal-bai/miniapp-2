/** Reserved keys stored outside productSchema (variants live in attributes JSON + ProductStock). */
export const RESERVED_PRODUCT_ATTR_KEYS = new Set(["variants"]);

/**
 * Keys often left in `product.attributes` after vertical template migrations.
 * Informational only — stripping is driven by the active productSchema keys.
 */
export const LEGACY_STALE_PRODUCT_ATTR_KEYS = [
  "size",
  "color",
  "brand",
  "material",
  "gender",
  "bouquetCount",
  "bouquetType",
  "deliveryDate",
  "packaging",
  "freshness",
  "occasion",
  "postcard",
  "volume",
  "hotOrCold",
  "sugar",
  "syrups",
  "spicy",
  "combo",
  "addons",
] as const;

export type StripProductAttributesResult = {
  value: Record<string, unknown>;
  strippedKeys: string[];
  staleLegacyKeys: string[];
};

export function schemaKeysFromProductSchema(
  schema: Record<string, unknown> | null | undefined,
): string[] {
  if (schema == null || typeof schema !== "object" || Array.isArray(schema)) {
    return [];
  }
  return Object.keys(schema);
}

/** Keep only keys allowed by the current vertical productSchema (+ drop reserved keys). */
export function stripProductAttributesToSchema(
  allowedKeys: readonly string[],
  raw: unknown,
): StripProductAttributesResult {
  const allowed = new Set(allowedKeys);
  const staleSet = new Set<string>(LEGACY_STALE_PRODUCT_ATTR_KEYS);
  const strippedKeys: string[] = [];
  const staleLegacyKeys: string[] = [];

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { value: {}, strippedKeys, staleLegacyKeys };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (RESERVED_PRODUCT_ATTR_KEYS.has(k) || !allowed.has(k)) {
      strippedKeys.push(k);
      if (staleSet.has(k)) staleLegacyKeys.push(k);
      continue;
    }
    out[k] = v;
  }

  return { value: out, strippedKeys, staleLegacyKeys };
}
