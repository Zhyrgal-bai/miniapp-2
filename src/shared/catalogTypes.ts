import type { ProductStatus } from "@prisma/client";

export type { ProductStatus };

export const PRODUCT_STATUSES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

export type ProductListSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "name_asc";

export type ParsedProductListQuery = {
  q: string | null;
  categoryId: number | null;
  /** null = ACTIVE only (storefront default); empty array with allStatuses = all */
  statuses: ProductStatus[] | null;
  allStatuses: boolean;
  limit: number | null;
  offset: number | null;
  sort: ProductListSort;
  paginated: boolean;
};

export type ProductBulkPatch = {
  status?: ProductStatus;
  categoryId?: number;
};

export function parseProductStatus(raw: unknown): ProductStatus | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "DRAFT" || s === "ARCHIVED") return s;
  return null;
}

export function parseProductListSort(raw: unknown): ProductListSort {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "price_asc" || s === "price_desc" || s === "name_asc" || s === "newest") {
    return s;
  }
  return "newest";
}

export function parseProductListQuery(params: Record<string, unknown>): ParsedProductListQuery {
  const qRaw = params.q ?? params.search;
  const q =
    qRaw != null && String(qRaw).trim() !== "" ? String(qRaw).trim() : null;

  const categoryRaw = params.categoryId ?? params.category;
  let categoryId: number | null = null;
  if (categoryRaw != null && String(categoryRaw).trim() !== "") {
    const n = Number(categoryRaw);
    if (Number.isFinite(n)) categoryId = n;
  }

  const statusRaw = params.status;
  let allStatuses = false;
  let statuses: ProductStatus[] | null = null;

  if (statusRaw == null || String(statusRaw).trim() === "") {
    statuses = ["ACTIVE"];
  } else {
    const statusStr = String(statusRaw).trim().toLowerCase();
    if (statusStr === "all" || statusStr === "*") {
      allStatuses = true;
      statuses = null;
    } else {
      const parts = statusStr.split(",").map((p) => p.trim());
      const parsed: ProductStatus[] = [];
      for (const p of parts) {
        const st = parseProductStatus(p);
        if (st) parsed.push(st);
      }
      statuses = parsed.length > 0 ? parsed : ["ACTIVE"];
    }
  }

  const limitRaw = params.limit;
  const offsetRaw = params.offset;
  let limit: number | null = null;
  let offset: number | null = null;
  const paginated =
    (limitRaw != null && String(limitRaw).trim() !== "") ||
    (offsetRaw != null && String(offsetRaw).trim() !== "");

  if (limitRaw != null && String(limitRaw).trim() !== "") {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) limit = Math.min(500, Math.floor(n));
  }
  if (offsetRaw != null && String(offsetRaw).trim() !== "") {
    const n = Number(offsetRaw);
    if (Number.isFinite(n) && n >= 0) offset = Math.floor(n);
  }

  const sort = parseProductListSort(params.sort);

  return {
    q,
    categoryId,
    statuses,
    allStatuses,
    limit,
    offset: offset ?? (paginated ? 0 : null),
    sort,
    paginated,
  };
}

export function queryRequiresMerchantCatalogAccess(
  query: ParsedProductListQuery,
): boolean {
  if (query.allStatuses) return true;
  if (query.statuses == null) return false;
  return query.statuses.some((s) => s !== "ACTIVE");
}

export function parseProductBulkPatch(body: unknown): ProductBulkPatch | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const patch: ProductBulkPatch = {};
  if (o.status !== undefined) {
    const st = parseProductStatus(o.status);
    if (!st) return null;
    patch.status = st;
  }
  if (o.categoryId !== undefined) {
    const n = Number(o.categoryId);
    if (!Number.isFinite(n)) return null;
    patch.categoryId = n;
  }
  if (patch.status === undefined && patch.categoryId === undefined) return null;
  return patch;
}

export function parseBulkProductIds(body: unknown): number[] | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const out: number[] = [];
  for (const id of ids) {
    const n = Number(id);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}
