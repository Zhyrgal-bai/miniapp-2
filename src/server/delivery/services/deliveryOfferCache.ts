const DEFAULT_TTL_MS = 30 * 60_000;

export type CachedDeliveryOffer = {
  payload: string;
  merchantId: number;
  price: number;
  currency: string;
  expiresAt: string | null;
  cachedAt: number;
  provider?: string;
};

type CacheEntry = CachedDeliveryOffer & { expiresAtMs: number };

function ttlMs(): number {
  const raw = process.env.YANDEX_DELIVERY_OFFER_CACHE_TTL_MS?.trim();
  if (!raw) return DEFAULT_TTL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 3_600_000) : DEFAULT_TTL_MS;
}

function isOfferExpired(offer: CachedDeliveryOffer): boolean {
  if (!offer.expiresAt) return false;
  const ts = Date.parse(offer.expiresAt);
  return Number.isFinite(ts) && ts <= Date.now();
}

export type DeliveryOfferCache = {
  put(providerOfferId: string, offer: Omit<CachedDeliveryOffer, "cachedAt">): void;
  get(providerOfferId: string): CachedDeliveryOffer | null;
  consume(providerOfferId: string): CachedDeliveryOffer | null;
};

export function createDeliveryOfferCache(): DeliveryOfferCache {
  const store = new Map<string, CacheEntry>();

  function purgeExpired(key: string, entry: CacheEntry): boolean {
    if (Date.now() > entry.expiresAtMs || isOfferExpired(entry)) {
      store.delete(key);
      return true;
    }
    return false;
  }

  return {
    put(providerOfferId, offer) {
      const id = providerOfferId.trim();
      if (id === "" || offer.payload.trim() === "") return;
      store.set(id, {
        ...offer,
        cachedAt: Date.now(),
        expiresAtMs: Date.now() + ttlMs(),
      });
    },

    get(providerOfferId) {
      const id = providerOfferId.trim();
      if (id === "") return null;
      const entry = store.get(id);
      if (!entry) return null;
      if (purgeExpired(id, entry)) return null;
      const { expiresAtMs: _e, ...rest } = entry;
      return rest;
    },

    consume(providerOfferId) {
      const offer = this.get(providerOfferId);
      if (offer) store.delete(providerOfferId.trim());
      return offer;
    },
  };
}

export const defaultDeliveryOfferCache = createDeliveryOfferCache();
