import type { Product } from "../../../types";

export type CommerceEvent =
  | { type: "view_product"; ts: number; productId: number; categoryId: number | null }
  | { type: "view_category"; ts: number; categoryId: number }
  | { type: "add_to_cart"; ts: number; productId: number; categoryId: number | null; qty: number };

export type CommerceSessionState = {
  version: 1;
  businessId: number;
  updatedAt: number;
  viewedProducts: Array<{ productId: number; categoryId: number | null; ts: number }>;
  viewedCategories: Array<{ categoryId: number; ts: number }>;
  events: CommerceEvent[];
};

const MAX_VIEWED_PRODUCTS = 32;
const MAX_VIEWED_CATEGORIES = 32;
const MAX_EVENTS = 120;

function key(businessId: number): string {
  return `sf:runtime:commerceSession:v1:${businessId}`;
}

function now(): number {
  return Date.now();
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function loadCommerceSession(businessId: number): CommerceSessionState {
  const bid = Number(businessId);
  if (!Number.isFinite(bid) || bid <= 0) {
    return {
      version: 1,
      businessId: 0,
      updatedAt: now(),
      viewedProducts: [],
      viewedCategories: [],
      events: [],
    };
  }
  const raw = safeParse(sessionStorage.getItem(key(bid)));
  if (!isObj(raw)) {
    return {
      version: 1,
      businessId: bid,
      updatedAt: now(),
      viewedProducts: [],
      viewedCategories: [],
      events: [],
    };
  }
  const vp = Array.isArray(raw.viewedProducts) ? raw.viewedProducts : [];
  const vc = Array.isArray(raw.viewedCategories) ? raw.viewedCategories : [];
  const ev = Array.isArray(raw.events) ? raw.events : [];
  return {
    version: 1,
    businessId: bid,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now(),
    viewedProducts: vp
      .map((x) => (isObj(x) ? x : null))
      .filter(Boolean)
      .map((x) => ({
        productId: Number(x!.productId) || 0,
        categoryId:
          x!.categoryId == null ? null : (Number(x!.categoryId) || null),
        ts: Number(x!.ts) || 0,
      }))
      .filter((x) => x.productId > 0)
      .slice(0, MAX_VIEWED_PRODUCTS),
    viewedCategories: vc
      .map((x) => (isObj(x) ? x : null))
      .filter(Boolean)
      .map((x) => ({
        categoryId: Number(x!.categoryId) || 0,
        ts: Number(x!.ts) || 0,
      }))
      .filter((x) => x.categoryId > 0)
      .slice(0, MAX_VIEWED_CATEGORIES),
    events: ev
      .map((x) => (isObj(x) ? (x as Record<string, unknown>) : null))
      .filter(Boolean)
      .slice(0, MAX_EVENTS) as CommerceEvent[],
  };
}

const COMMERCE_SESSION_CHANGED = "sf:commerceSessionChanged";

function notifyCommerceSessionChanged(businessId: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(COMMERCE_SESSION_CHANGED, { detail: { businessId } }),
  );
}

export function saveCommerceSession(state: CommerceSessionState): void {
  const bid = Number(state.businessId);
  if (!Number.isFinite(bid) || bid <= 0) return;
  const next: CommerceSessionState = {
    ...state,
    version: 1,
    businessId: bid,
    updatedAt: now(),
    viewedProducts: state.viewedProducts.slice(0, MAX_VIEWED_PRODUCTS),
    viewedCategories: state.viewedCategories.slice(0, MAX_VIEWED_CATEGORIES),
    events: state.events.slice(-MAX_EVENTS),
  };
  try {
    sessionStorage.setItem(key(bid), JSON.stringify(next));
    notifyCommerceSessionChanged(bid);
  } catch {
    /* ignore */
  }
}

function upsertRecent<T extends { ts: number }>(arr: T[], item: T, same: (a: T, b: T) => boolean, max: number): T[] {
  const next = [item, ...arr.filter((x) => !same(x, item))];
  return next.sort((a, b) => b.ts - a.ts).slice(0, max);
}

export function recordViewProduct(params: { businessId: number; product: Product }): void {
  const bid = Number(params.businessId);
  if (!Number.isFinite(bid) || bid <= 0) return;
  const pid = Number(params.product.id ?? 0);
  if (!Number.isFinite(pid) || pid <= 0) return;
  const cid = params.product.categoryId != null ? Number(params.product.categoryId) : null;
  const st = loadCommerceSession(bid);
  const t = now();
  st.viewedProducts = upsertRecent(
    st.viewedProducts,
    { productId: pid, categoryId: Number.isFinite(Number(cid)) ? (Number(cid) as number) : null, ts: t },
    (a, b) => a.productId === b.productId,
    MAX_VIEWED_PRODUCTS,
  );
  if (cid != null && Number.isFinite(cid) && cid > 0) {
    st.viewedCategories = upsertRecent(
      st.viewedCategories,
      { categoryId: cid, ts: t },
      (a, b) => a.categoryId === b.categoryId,
      MAX_VIEWED_CATEGORIES,
    );
    st.events.push({ type: "view_category", ts: t, categoryId: cid });
  }
  st.events.push({ type: "view_product", ts: t, productId: pid, categoryId: cid ?? null });
  saveCommerceSession(st);
}

/** Category chip tap — feeds «Потому что вы смотрели» without opening a product. */
export function recordViewCategory(params: {
  businessId: number;
  categoryId: number;
}): void {
  const bid = Number(params.businessId);
  const cid = Number(params.categoryId);
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(cid) || cid <= 0) return;
  const st = loadCommerceSession(bid);
  const t = now();
  st.viewedCategories = upsertRecent(
    st.viewedCategories,
    { categoryId: cid, ts: t },
    (a, b) => a.categoryId === b.categoryId,
    MAX_VIEWED_CATEGORIES,
  );
  st.events.push({ type: "view_category", ts: t, categoryId: cid });
  saveCommerceSession(st);
}

export function recordAddToCart(params: { businessId: number; product: Product; qty: number }): void {
  const bid = Number(params.businessId);
  if (!Number.isFinite(bid) || bid <= 0) return;
  const pid = Number(params.product.id ?? 0);
  if (!Number.isFinite(pid) || pid <= 0) return;
  const cid = params.product.categoryId != null ? Number(params.product.categoryId) : null;
  const st = loadCommerceSession(bid);
  const t = now();
  st.events.push({
    type: "add_to_cart",
    ts: t,
    productId: pid,
    categoryId: cid != null && Number.isFinite(cid) ? cid : null,
    qty: Math.max(1, Math.round(Number(params.qty) || 1)),
  });
  saveCommerceSession(st);
}

export function getRecentlyViewedProductIds(businessId: number): number[] {
  const st = loadCommerceSession(businessId);
  return st.viewedProducts.map((x) => x.productId);
}

export function categoryAffinities(businessId: number): Map<number, number> {
  const st = loadCommerceSession(businessId);
  const m = new Map<number, number>();
  for (const c of st.viewedCategories) {
    const prev = m.get(c.categoryId) ?? 0;
    m.set(c.categoryId, prev + 1);
  }
  // Add-to-cart counts are stronger signal
  for (const e of st.events) {
    if (e.type !== "add_to_cart") continue;
    if (e.categoryId == null) continue;
    const prev = m.get(e.categoryId) ?? 0;
    m.set(e.categoryId, prev + 3);
  }
  return m;
}

