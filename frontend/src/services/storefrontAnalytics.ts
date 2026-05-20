/**
 * Storefront analytics event ingest (audience & conversion).
 */
import { api, TENANT_HEADER } from "./api";
import { getWebAppUserId } from "../utils/telegramUserId";

const VISITOR_KEY_STORAGE = "sf:visitor:key";

function getOrCreateVisitorKey(): string {
  try {
    const existing = sessionStorage.getItem(VISITOR_KEY_STORAGE);
    if (existing && existing.length >= 8) return existing;
    const uid = getWebAppUserId();
    const key =
      uid > 0
        ? `tg:${uid}`
        : `anon:${crypto.randomUUID?.() ?? String(Date.now())}`;
    sessionStorage.setItem(VISITOR_KEY_STORAGE, key);
    return key;
  } catch {
    return `anon:${Date.now()}`;
  }
}

type EventInput = {
  eventType: "STORE_VIEW" | "PRODUCT_VIEW" | "ADD_TO_CART" | "CHECKOUT_START";
  productId?: number;
};

const queue: EventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(businessId: number): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStorefrontEvents(businessId);
  }, 800);
}

export function trackStorefrontEvent(
  businessId: number,
  event: EventInput,
): void {
  if (!Number.isInteger(businessId) || businessId <= 0) return;
  queue.push(event);
  scheduleFlush(businessId);
}

async function flushStorefrontEvents(businessId: number): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, 32);
  const visitorKey = getOrCreateVisitorKey();
  const uid = getWebAppUserId();
  try {
    await api.post(
      "/api/storefront/events",
      {
        events: batch.map((ev) => ({
          eventType: ev.eventType,
          visitorKey,
          userId: uid > 0 ? uid : null,
          productId: ev.productId ?? null,
        })),
      },
      { headers: { [TENANT_HEADER]: String(businessId) } },
    );
  } catch {
    /* non-blocking */
  }
}

export function trackStoreView(businessId: number): void {
  trackStorefrontEvent(businessId, { eventType: "STORE_VIEW" });
}

export function trackProductView(businessId: number, productId: number): void {
  trackStorefrontEvent(businessId, {
    eventType: "PRODUCT_VIEW",
    productId,
  });
}

export function trackAddToCart(businessId: number, productId: number): void {
  trackStorefrontEvent(businessId, {
    eventType: "ADD_TO_CART",
    productId,
  });
}

export function trackCheckoutStart(businessId: number): void {
  trackStorefrontEvent(businessId, { eventType: "CHECKOUT_START" });
}
