import type { Product } from "../types";

function normalizeSearch(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match product name, description, category name (if present on DTO). */
export function filterProductsBySearch(products: Product[], query: string): Product[] {
  const q = normalizeSearch(query);
  if (q === "") return products;
  return products.filter((p) => {
    const name = String(p.name ?? "").toLowerCase();
    const desc = String((p as { description?: string }).description ?? "").toLowerCase();
    const cat =
      typeof (p as { category?: { name?: string } }).category?.name === "string"
        ? String((p as { category?: { name?: string } }).category!.name).toLowerCase()
        : "";
    return name.includes(q) || desc.includes(q) || cat.includes(q);
  });
}
