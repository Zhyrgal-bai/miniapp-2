import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastStore = {
  items: ToastItem[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (message, kind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ items: [...s.items, { id, message, kind }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function showErrorToast(message: string): void {
  useToastStore.getState().push(message, "error");
}

export function showSuccessToast(message: string): void {
  useToastStore.getState().push(message, "success");
}
