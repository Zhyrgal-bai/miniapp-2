import { create } from "zustand";
import {
  cartLineIdentityKey,
  cartLinesEqual,
  type CartLineStorage,
} from "../commerce/cartLineIdentity";

export type CartItem = CartLineStorage & {
  name: string;
  price: number;
  image?: string;
  quantity: number;
};

type CartStore = {
  tenantShopId: string | null;
  reservationId: number | null;

  syncTenantShopId: (shopId: string | null) => void;
  setReservationId: (id: number | null) => void;
  items: CartItem[];

  addItem: (item: CartItem) => void;
  removeItem: (item: CartItem) => void;
  clearCart: () => void;

  getTotal: () => number;
};

export { cartLineIdentityKey, cartLinesEqual };

/** Pure tenant switch — exported for smoke tests (C1 slug-resolve cart wipe). */
export function nextCartStateAfterTenantSync(
  state: Pick<CartStore, "tenantShopId" | "reservationId" | "items">,
  shopId: string | null,
): Pick<CartStore, "tenantShopId" | "reservationId" | "items"> {
  if (shopId == null) return state;
  if (state.tenantShopId === shopId) return state;
  return {
    tenantShopId: shopId,
    reservationId: null,
    items: [],
  };
}

/** Validates a persisted cart line — drops corrupt localStorage rows (M3). */
export function isValidPersistedCartItem(item: unknown): item is CartItem {
  if (item == null || typeof item !== "object") return false;
  const row = item as CartItem;
  return (
    typeof row.productId === "number" &&
    Number.isFinite(row.productId) &&
    row.productId > 0 &&
    typeof row.name === "string" &&
    row.name.trim() !== "" &&
    typeof row.price === "number" &&
    Number.isFinite(row.price) &&
    row.price >= 0 &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity > 0
  );
}

const CART_STORAGE_KEY = "sf-cart-v1";

type CartPersist = Pick<CartStore, "tenantShopId" | "reservationId" | "items">;

function loadPersistedCart(): CartPersist {
  if (typeof localStorage === "undefined") {
    return { tenantShopId: null, reservationId: null, items: [] };
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw == null || raw === "") {
      return { tenantShopId: null, reservationId: null, items: [] };
    }
    const parsed = JSON.parse(raw) as Partial<CartPersist>;
    if (!Array.isArray(parsed.items)) {
      return { tenantShopId: null, reservationId: null, items: [] };
    }
    return {
      tenantShopId:
        typeof parsed.tenantShopId === "string" ? parsed.tenantShopId : null,
      reservationId:
        typeof parsed.reservationId === "number" &&
        Number.isFinite(parsed.reservationId)
          ? parsed.reservationId
          : null,
      items: parsed.items.filter(isValidPersistedCartItem),
    };
  } catch {
    return { tenantShopId: null, reservationId: null, items: [] };
  }
}

function persistCart(state: CartPersist): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

const initialCart = loadPersistedCart();

export const useCartStore = create<CartStore>((set, get) => ({
  tenantShopId: initialCart.tenantShopId,
  reservationId: initialCart.reservationId,

  syncTenantShopId: (shopId) =>
    set((state) => nextCartStateAfterTenantSync(state, shopId)),

  setReservationId: (id) => set({ reservationId: id }),

  items: initialCart.items,

  addItem: (item) =>
    set((state) => {
      const key = cartLineIdentityKey(item);
      const idx = state.items.findIndex(
        (i) => cartLineIdentityKey(i) === key,
      );
      if (idx >= 0) {
        const next = [...state.items];
        next[idx] = { ...next[idx], ...item };
        return { items: next };
      }
      return { items: [...state.items, item] };
    }),

  removeItem: (item) =>
    set((state) => ({
      items: state.items.filter((i) => !cartLinesEqual(i, item)),
    })),

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));

useCartStore.subscribe((state) => {
  persistCart({
    tenantShopId: state.tenantShopId,
    reservationId: state.reservationId,
    items: state.items,
  });
});
