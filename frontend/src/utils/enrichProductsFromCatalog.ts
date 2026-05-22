import type { Product } from "../types";

/** Merge full catalog rows (GET /products) into storefront payload featured rows. */
export function enrichProductsFromCatalog(
  list: Product[],
  catalog: Product[] | null | undefined,
): Product[] {
  if (catalog == null || catalog.length === 0) return list;
  const byId = new Map<number, Product>();
  for (const p of catalog) {
    const id = Number(p.id ?? 0);
    if (id > 0) byId.set(id, p);
  }
  return list.map((fp) => {
    const id = Number(fp.id ?? 0);
    const fromCatalog = id > 0 ? byId.get(id) : undefined;
    if (!fromCatalog) return fp;
    const sold30d =
      (fp as Product & { sold30d?: number }).sold30d ??
      (fromCatalog as Product & { sold30d?: number }).sold30d;
    return {
      ...fp,
      ...fromCatalog,
      sold: fp.sold ?? fromCatalog.sold,
      ...(sold30d != null ? { sold30d } : {}),
    };
  });
}
