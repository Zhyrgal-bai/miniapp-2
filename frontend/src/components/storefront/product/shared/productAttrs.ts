import type { Product } from "../../../../types";

export function productAttrs(product: Product): Record<string, unknown> {
  if (
    product.attributes != null &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes)
  ) {
    return product.attributes as Record<string, unknown>;
  }
  return {};
}

export function pickString(attrs: Record<string, unknown>, key: string): string | null {
  const value = attrs[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function pickNumber(attrs: Record<string, unknown>, key: string): number | null {
  const value = attrs[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
