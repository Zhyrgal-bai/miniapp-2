import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { nextCartStateAfterTenantSync } from "../../frontend/src/store/useCartStore.js";
import { isCheckoutSubmitBlocked } from "../../frontend/src/commerce/checkoutSubmitGuard.js";
import {
  SF_PENDING_FINIK_ORDER_KEY,
  readPendingFinikOrder,
  setPendingFinikOrder,
  clearPendingFinikOrder,
  shouldReleaseCheckoutSubmitOnResume,
} from "../../frontend/src/utils/pendingFinikOrder.js";

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

describe("C1 cart tenant sync (slug resolve)", () => {
  const item = {
    productId: 1,
    name: "Rose",
    price: 1000,
    quantity: 1,
  };

  it("keeps cart when shopId is null (slug still resolving)", () => {
    const state = {
      tenantShopId: "42",
      reservationId: null,
      items: [item],
    };
    const next = nextCartStateAfterTenantSync(state, null);
    expect(next).toBe(state);
    expect(next.items).toHaveLength(1);
  });

  it("keeps cart when tenant id unchanged", () => {
    const state = {
      tenantShopId: "42",
      reservationId: 7,
      items: [item],
    };
    const next = nextCartStateAfterTenantSync(state, "42");
    expect(next).toBe(state);
    expect(next.reservationId).toBe(7);
  });

  it("clears cart when switching to another tenant", () => {
    const state = {
      tenantShopId: "42",
      reservationId: 7,
      items: [item],
    };
    const next = nextCartStateAfterTenantSync(state, "99");
    expect(next.tenantShopId).toBe("99");
    expect(next.items).toEqual([]);
    expect(next.reservationId).toBeNull();
  });
});

describe("C2 checkout double submit guard", () => {
  it("blocks when sync lock is true before submitting state updates", () => {
    expect(isCheckoutSubmitBlocked(true, false)).toBe(true);
  });

  it("blocks when submitting state is true", () => {
    expect(isCheckoutSubmitBlocked(false, true)).toBe(true);
  });

  it("allows submit when neither lock nor submitting", () => {
    expect(isCheckoutSubmitBlocked(false, false)).toBe(false);
  });
});

describe("C3 Finik pending order / resume", () => {
  beforeEach(() => {
    installLocalStorageMock();
    clearPendingFinikOrder();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists pending Finik order for redirect polling", () => {
    setPendingFinikOrder({
      orderId: 101,
      businessId: 5,
      paymentUrl: "https://pay.example/101",
    });
    const pending = readPendingFinikOrder();
    expect(pending?.orderId).toBe(101);
    expect(pending?.businessId).toBe(5);
    expect(pending?.paymentUrl).toBe("https://pay.example/101");
  });

  it("does not release checkout submit on resume while Finik pending", () => {
    setPendingFinikOrder({ orderId: 1, businessId: 2 });
    expect(shouldReleaseCheckoutSubmitOnResume()).toBe(false);
  });

  it("releases checkout submit on resume when no pending Finik order", () => {
    expect(shouldReleaseCheckoutSubmitOnResume()).toBe(true);
  });

  it("clears pending key from storage", () => {
    setPendingFinikOrder({ orderId: 1, businessId: 2 });
    clearPendingFinikOrder();
    expect(localStorage.getItem(SF_PENDING_FINIK_ORDER_KEY)).toBeNull();
  });
});
