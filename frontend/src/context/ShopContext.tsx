/* Context module exports both provider and hook (Fast Refresh convention). */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { readShopIdString } from "../utils/storeParams";
import { useCartStore } from "../store/useCartStore";

export type ShopContextValue = {
  /** `Business.id` тенанта из `?shop=` / `?businessId=` / Telegram Mini App start_param */
  businessId: number | null;
  shopIdString: string | undefined;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { search } = useLocation();
  const [searchTick, setSearchTick] = useState(0);
  const [telegramTick, setTelegramTick] = useState(0);

  useEffect(() => {
    setSearchTick((n) => n + 1);
  }, [search]);

  useEffect(() => {
    const id = window.setTimeout(() => setTelegramTick((n) => n + 1), 200);
    return () => window.clearTimeout(id);
  }, [search]);

  const value = useMemo<ShopContextValue>(() => {
    void searchTick;
    void telegramTick;
    const shopIdString = readShopIdString();
    const n = shopIdString ? Number(shopIdString) : NaN;
    const businessId =
      Number.isInteger(n) && n > 0 ? n : null;
    return {
      businessId,
      shopIdString,
    };
  }, [searchTick, telegramTick]);

  useEffect(() => {
    useCartStore.getState().syncTenantShopId(value.shopIdString ?? null);
  }, [value.shopIdString]);

  return (
    <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
  );
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error("useShop must be used within ShopProvider");
  }
  return ctx;
}
