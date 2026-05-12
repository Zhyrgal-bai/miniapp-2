import { create } from "zustand";
import type { Product } from "../types";
import { adminService } from "../services/admin.service";

interface AdminState {
  products: Product[];
  fetchProducts: () => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  products: [],

  fetchProducts: async () => {
    const data = await adminService.getProducts();
    set({ products: data });
  },

  addProduct: async (p) => {
    await adminService.createProduct(p);
    const data = await adminService.getProducts();
    set({ products: data });
  },

  deleteProduct: async (id) => {
    await adminService.deleteProduct(id);
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }));
  },
}));