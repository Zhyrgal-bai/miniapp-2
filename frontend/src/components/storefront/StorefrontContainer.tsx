import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useShop } from "../../context/ShopContext";
import { StorefrontRenderer, type ResolvedStorefrontPayload } from "./StorefrontRenderer";

export function StorefrontContainer(): React.ReactElement {
  const { businessId } = useShop();
  const [payload, setPayload] = useState<ResolvedStorefrontPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId == null) {
      setPayload(null);
      setError("Магазин не найден");
      return;
    }
    let cancelled = false;
    setError(null);
    setPayload(null);
    void (async () => {
      try {
        const res = await api.get(`/api/storefront/${businessId}`);
        if (!cancelled) setPayload(res.data as ResolvedStorefrontPayload);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("Не удалось загрузить витрину");
          setPayload(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (error) {
    return <div style={{ padding: 16, opacity: 0.8 }}>{error}</div>;
  }

  if (!payload) {
    return <div style={{ padding: 16, opacity: 0.8 }}>Загрузка…</div>;
  }

  return <StorefrontRenderer payload={payload} />;
}

