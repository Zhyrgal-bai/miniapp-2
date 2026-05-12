import { create } from "zustand";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  image?: string;
  size: string;
  color: string;
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
    set((state) => ({
      items: [...state.items, item],
    })),

  removeItem: (item) =>
    set((state) => ({
      items: state.items.filter(
        (i) =>
          !(
            i.productId === item.productId &&
            i.size === item.size &&
            i.color === item.color
          )
      ),
    })),

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));