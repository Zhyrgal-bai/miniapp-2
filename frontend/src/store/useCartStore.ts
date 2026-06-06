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
      items: parsed.items.filter(
        (item): item is CartItem =>
          item != null &&
          typeof item === "object" &&
          typeof (item as CartItem).name === "string" &&
          typeof (item as CartItem).price === "number" &&
          typeof (item as CartItem).quantity === "number",
      ),
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
    set((state) => ({
      tenantShopId: shopId,
      reservationId:
        state.tenantShopId === shopId ? state.reservationId : null,
      items:
        state.tenantShopId === shopId || state.items.length === 0
          ? state.items
          : [],
    })),

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
