import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  isValidPersistedCartItem,
} from "../../frontend/src/store/useCartStore.js";
import {
  hasVisibleScrollLockOverlay,
} from "../../frontend/src/utils/bodyScrollLock.js";
import {
  hasPendingFinikCheckout,
  setPendingFinikOrder,
  clearPendingFinikOrder,
  shouldReleaseCheckoutSubmitOnResume,
  releasePendingFinikCheckout,
  isPendingFinikCheckoutExpired,
} from "../../frontend/src/utils/pendingFinikOrder.js";
import { FINIK_PAYMENT_RELEASED_EVENT } from "../../frontend/src/utils/finikPaymentEvents.js";

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage);
}

describe("M3 cart localStorage validation", () => {
  it("accepts valid persisted cart line", () => {
    expect(
      isValidPersistedCartItem({
        productId: 12,
        name: "Rose",
        price: 1500,
        quantity: 2,
      }),
    ).toBe(true);
  });

  it("rejects line without productId", () => {
    expect(
      isValidPersistedCartItem({
        name: "Rose",
        price: 1500,
        quantity: 1,
      }),
    ).toBe(false);
  });

  it("rejects line with invalid productId", () => {
    expect(
      isValidPersistedCartItem({
        productId: 0,
        name: "Rose",
        price: 1500,
        quantity: 1,
      }),
    ).toBe(false);
  });

  it("rejects line with zero quantity", () => {
    expect(
      isValidPersistedCartItem({
        productId: 1,
        name: "Rose",
        price: 1500,
        quantity: 0,
      }),
    ).toBe(false);
  });

  it("rejects line with empty name", () => {
    expect(
      isValidPersistedCartItem({
        productId: 1,
        name: "   ",
        price: 1500,
        quantity: 1,
      }),
    ).toBe(false);
  });
});

describe("M2 scroll lock overlay guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when no overlay backdrop in DOM", () => {
    vi.stubGlobal("document", {
      querySelector: () => null,
    });
    expect(hasVisibleScrollLockOverlay()).toBe(false);
  });

  it("returns true when overlay backdrop is mounted", () => {
    vi.stubGlobal("document", {
      querySelector: (sel: string) =>
        String(sel).includes("archa-overlay__backdrop") ? {} : null,
    });
    expect(hasVisibleScrollLockOverlay()).toBe(true);
  });
});

describe("M5 Finik resume state", () => {
  beforeEach(() => {
    installLocalStorageMock();
    clearPendingFinikOrder();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hasPendingFinikCheckout when order awaiting payment", () => {
    setPendingFinikOrder({ orderId: 9, businessId: 3 });
    expect(hasPendingFinikCheckout()).toBe(true);
    expect(shouldReleaseCheckoutSubmitOnResume()).toBe(false);
  });

  it("no pending checkout after payment cleared", () => {
    expect(hasPendingFinikCheckout()).toBe(false);
    expect(shouldReleaseCheckoutSubmitOnResume()).toBe(true);
  });

  it("releasePendingFinikCheckout clears storage and emits event", () => {
    const events: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (ev: Event) => {
        events.push(ev.type);
        return true;
      },
    });
    setPendingFinikOrder({ orderId: 9, businessId: 3, startedAt: Date.now() - 1000 });
    releasePendingFinikCheckout();
    expect(hasPendingFinikCheckout()).toBe(false);
    expect(events).toContain(FINIK_PAYMENT_RELEASED_EVENT);
  });

  it("isPendingFinikCheckoutExpired after timeout window", () => {
    setPendingFinikOrder({
      orderId: 9,
      businessId: 3,
      startedAt: Date.now() - 16 * 60 * 1000,
    });
    expect(isPendingFinikCheckoutExpired()).toBe(true);
  });
});
