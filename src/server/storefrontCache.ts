import type { ResolvedStorefrontPayload } from "../storefront/schema.js";

type CacheRow = {
  payload: ResolvedStorefrontPayload;
  expiresAt: number;
};

const CACHE = new Map<number, CacheRow>();
const DEFAULT_TTL_MS = 60_000;

export function getCachedStorefrontPayload(
  businessId: number,
): ResolvedStorefrontPayload | null {
  const row = CACHE.get(businessId);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    CACHE.delete(businessId);
    return null;
  }
  return row.payload;
}

export function setCachedStorefrontPayload(params: {
  businessId: number;
  payload: ResolvedStorefrontPayload;
  ttlMs?: number;
}): void {
  const ttl = typeof params.ttlMs === "number" && params.ttlMs > 0 ? params.ttlMs : DEFAULT_TTL_MS;
  CACHE.set(params.businessId, { payload: params.payload, expiresAt: Date.now() + ttl });
}

export function invalidateStorefrontCache(businessId: number): void {
  CACHE.delete(businessId);
}

