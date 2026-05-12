/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../services/api";
import { useShop } from "../../../context/ShopContext";
import type { ResolvedStorefrontPayload } from "../StorefrontRenderer";
import { safeParseStorefrontPublicApiResponse } from "@repo-storefront/storefrontPublicApiResponseSchema";

type StorefrontPayloadCtx = {
  payload: ResolvedStorefrontPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<StorefrontPayloadCtx | null>(null);

export function StorefrontPayloadProvider(props: { children: React.ReactNode }): React.ReactElement {
  const { businessId } = useShop();
  const [payload, setPayload] = useState<ResolvedStorefrontPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborted = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (businessId == null) {
      setPayload(null);
      setError("Магазин не найден");
      setLoading(false);
      return;
    }
    aborted.current?.abort();
    const ac = new AbortController();
    aborted.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/storefront/${businessId}`, { signal: ac.signal });
      if (ac.signal.aborted) return;
      const parsed = safeParseStorefrontPublicApiResponse(res.data);
      if (!parsed.ok) {
        console.error("[StorefrontPayload]", parsed.error);
        setPayload(null);
        setError("Некорректный ответ витрины");
        return;
      }
      setPayload(parsed.data as ResolvedStorefrontPayload);
    } catch (e) {
      if (ac.signal.aborted) return;
      console.error(e);
      setPayload(null);
      setError("Не удалось загрузить витрину");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void refresh();
    return () => aborted.current?.abort();
  }, [refresh]);

  const value = useMemo<StorefrontPayloadCtx>(
    () => ({ payload, loading, error, refresh }),
    [payload, loading, error, refresh],
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useStorefrontPayload(): StorefrontPayloadCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStorefrontPayload must be used within StorefrontPayloadProvider");
  return v;
}

