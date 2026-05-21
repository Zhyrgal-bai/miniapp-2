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

  syncTenantShopId: (shopId: string | null) => void;
  items: CartItem[];

  addItem: (item: CartItem) => void;
  removeItem: (item: CartItem) => void;
  clearCart: () => void;

  getTotal: () => number;
};

export { cartLineIdentityKey, cartLinesEqual };

export const useCartStore = create<CartStore>((set, get) => ({
  tenantShopId: null,

  syncTenantShopId: (shopId) =>
    set((state) => ({
      tenantShopId: shopId,
      items:
        state.tenantShopId === shopId || state.items.length === 0
          ? state.items
          : [],
    })),

  items: [],

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
