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
