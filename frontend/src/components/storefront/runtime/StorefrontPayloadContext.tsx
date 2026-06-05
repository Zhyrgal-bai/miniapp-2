/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../../services/api";
import { useShop } from "../../../context/ShopContext";
import type { ResolvedStorefrontPayload } from "../StorefrontRenderer";
import { safeParseStorefrontPublicApiResponse } from "@repo-storefront/storefrontPublicApiResponseSchema";
import { readStoreSlugString, rememberResolvedStoreSlug, clearTenantSession } from "../../../utils/storeParams";

const FETCH_TIMEOUT_MS = 12_000;

type StorefrontPayloadCtx = {
  payload: ResolvedStorefrontPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<StorefrontPayloadCtx | null>(null);

export function StorefrontPayloadProvider(props: { children: React.ReactNode }): React.ReactElement {
  const { businessId } = useShop();
  const { pathname, search } = useLocation();
  const slug = useMemo(() => readStoreSlugString(pathname, search), [pathname, search]);
  const [payload, setPayload] = useState<ResolvedStorefrontPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborted = useRef<AbortController | null>(null);
  const transientRetries = useRef(0);

  useEffect(() => {
    transientRetries.current = 0;
  }, [slug, businessId]);

  const refresh = useCallback(async () => {
    aborted.current?.abort();
    const ac = new AbortController();
    aborted.current = ac;
    setLoading(true);
    setError(null);

    const url = slug
      ? `/api/storefront/by-slug/${encodeURIComponent(slug)}`
      : businessId != null
        ? `/api/storefront/${businessId}`
        : null;

    if (url == null) {
      setPayload(null);
      setError("Магазин не найден");
      setLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let keepLoading = false;

    try {
      const res = await api.get(url, { signal: ac.signal });
      if (aborted.current !== ac) return;
      const parsed = safeParseStorefrontPublicApiResponse(res.data);
      if (!parsed.ok) {
        console.error("[StorefrontPayload]", parsed.error);
        setPayload(null);
        setError("Некорректный ответ витрины");
        return;
      }
      const data = parsed.data as ResolvedStorefrontPayload;
      setPayload(data);
      transientRetries.current = 0;
      if (slug && typeof data.businessId === "number" && data.businessId > 0) {
        rememberResolvedStoreSlug(slug, data.businessId);
        window.dispatchEvent(new CustomEvent("sf:tenantResolved"));
      }
    } catch (e) {
      if (aborted.current !== ac) return;
      console.error(e);
      const resp = (e as { response?: { status?: number; data?: { error?: string } } })
        ?.response;
      const status = resp?.status;
      const apiMessage =
        typeof resp?.data?.error === "string" ? resp.data.error.trim() : "";
      const timedOut = ac.signal.aborted;
      const canRetry =
        (status == null || status >= 500 || timedOut) &&
        transientRetries.current < 2;
      if (canRetry) {
        transientRetries.current += 1;
        const delayMs = 500 * transientRetries.current;
        setError("Подключаем витрину…");
        keepLoading = true;
        window.setTimeout(() => {
          void refresh();
        }, delayMs);
        return;
      }
      setPayload(null);
      if (slug) {
        clearTenantSession();
      }
      if (status === 404) {
        setError(
          apiMessage !== ""
            ? apiMessage
            : "Магазин не найден. Проверьте ссылку или откройте витрину через Telegram.",
        );
      } else if (status === 403) {
        setError(
          apiMessage !== ""
            ? apiMessage
            : "Магазин временно недоступен. Подписка могла истечь — свяжитесь с владельцем.",
        );
      } else if (timedOut) {
        setError("Сервер не ответил вовремя. Попробуйте ещё раз.");
      } else {
        setError(
          apiMessage !== "" ? apiMessage : "Не удалось загрузить витрину",
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (!keepLoading && aborted.current === ac) {
        setLoading(false);
      }
    }
  }, [slug, businessId]);

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
