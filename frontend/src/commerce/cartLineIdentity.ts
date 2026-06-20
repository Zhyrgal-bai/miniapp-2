/** Stable cart line identity over clothing-shaped storage (size/color + options JSON). */

export type CartLineStorage = {
  productId: number;
  size: string;
  color: string;
  options?: Record<string, unknown>;
};

function stableOptionsKey(options: Record<string, unknown> | undefined): string {
  if (!options || Object.keys(options).length === 0) return "";
  const sorted = Object.keys(options)
    .sort()
    .map((k) => {
      const v = options[k];
      if (Array.isArray(v)) return `${k}=[${v.map(String).sort().join(",")}]`;
      return `${k}=${String(v)}`;
    });
  return sorted.join("&");
}

export function cartLineIdentityKey(line: CartLineStorage): string {
  return [
    line.productId,
    line.size,
    line.color,
    stableOptionsKey(line.options),
  ].join("|");
}

export function cartLinesEqual(a: CartLineStorage, b: CartLineStorage): boolean {
  return cartLineIdentityKey(a) === cartLineIdentityKey(b);
}

/** Normalize color for storage (non-clothing → empty string). */
export function storageColorForCart(
  businessType: string | null | undefined,
  color: string | null | undefined,
): string {
  const c = String(color ?? "").trim();
  if (c === "" || c === "default") return "";
  if (businessType === "clothing") return c;
  return "";
}

/** Cart qty for the currently selected variant only (no product-wide fallback). */
export function findCartLineForSelection<T extends CartLineStorage>(
  items: T[],
  params: {
    productId: number;
    size: string | null;
    storageColor: string;
    needsVariantPicker: boolean;
    businessType?: string | null;
    instantLine?: { size: string; color: string } | null;
  },
): T | null {
  const { productId, size, storageColor, needsVariantPicker, businessType, instantLine } =
    params;

  if (size) {
    const key = cartLineIdentityKey({
      productId,
      size,
      color: storageColor,
    });
    const exact = items.find((i) => cartLineIdentityKey(i) === key);
    if (exact) return exact;
  }

  if (!needsVariantPicker && instantLine) {
    const key = cartLineIdentityKey({
      productId,
      size: instantLine.size,
      color: storageColorForCart(businessType, instantLine.color),
    });
    return items.find((i) => cartLineIdentityKey(i) === key) ?? null;
  }

  return null;
}
