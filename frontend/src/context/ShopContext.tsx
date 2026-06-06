/* Context module exports both provider and hook (Fast Refresh convention). */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { readShopIdString, readStoreSlugString } from "../utils/storeParams";
import { useCartStore } from "../store/useCartStore";

export type ShopContextValue = {
  /** `Business.id` тенанта из `/s/:slug`, `?shop=` / `?businessId=` или Telegram Mini App */
  businessId: number | null;
  shopIdString: string | undefined;
  /** Публичный slug витрины (после резолва slug-маршрута). */
  storefrontSlug: string | null;
  /** Slug в URL ещё не сматчился с sessionStorage (идёт первый запрос). */
  tenantResolving: boolean;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { search, pathname } = useLocation();
  const [searchTick, setSearchTick] = useState(0);
  const [telegramTick, setTelegramTick] = useState(0);
  const [slugResolveTick, setSlugResolveTick] = useState(0);

  useEffect(() => {
    setSearchTick((n) => n + 1);
  }, [search, pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => setTelegramTick((n) => n + 1), 200);
    return () => window.clearTimeout(id);
  }, [search, pathname]);

  useEffect(() => {
    const bump = () => setSlugResolveTick((n) => n + 1);
    window.addEventListener("sf:tenantResolved", bump as EventListener);
    return () => window.removeEventListener("sf:tenantResolved", bump as EventListener);
  }, []);

  const value = useMemo<ShopContextValue>(() => {
    void searchTick;
    void telegramTick;
    void slugResolveTick;
    const shopIdString = readShopIdString(pathname, search);
    const n = shopIdString ? Number(shopIdString) : NaN;
    const businessId = Number.isInteger(n) && n > 0 ? n : null;
    const pathSlug = readStoreSlugString(pathname, search);
    const tenantResolving = Boolean(pathSlug) && !shopIdString;
    const storefrontSlug = pathSlug ?? null;
    return {
      businessId,
      shopIdString,
      storefrontSlug: storefrontSlug && storefrontSlug.trim() !== "" ? storefrontSlug : null,
      tenantResolving,
    };
  }, [searchTick, telegramTick, slugResolveTick, pathname, search]);

  useEffect(() => {
    useCartStore.getState().syncTenantShopId(value.shopIdString ?? null);
  }, [value.shopIdString]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return ctx;
}
