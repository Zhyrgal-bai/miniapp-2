import { useEffect, useMemo, useState } from "react";
import type { Product } from "../types";
import { api, TENANT_HEADER } from "../services/api";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { getRecentlyViewedIds } from "../components/storefront/discovery/recentlyViewed";
import { enrichProductsFromCatalog } from "../utils/enrichProductsFromCatalog";
import "../components/ui/FAQPage.css";

export default function FavoritesPage(): React.ReactElement {
  const { businessId } = useShop();
  const { payload } = useStorefrontPayload();
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    if (businessId == null || businessId <= 0) {
      setCatalog([]);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<Product[]>("/products", {
          headers: { [TENANT_HEADER]: String(businessId) },
        });
        if (!alive) return;
        setCatalog(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!alive) return;
        setCatalog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId]);

  const recentProducts = useMemo(() => {
    if (businessId == null || businessId <= 0) return [];
    const ids = getRecentlyViewedIds(businessId);
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const list: Product[] = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (p) list.push(p);
    }
    return enrichProductsFromCatalog(list, catalog);
  }, [businessId, catalog]);

  const txt = payload?.storefrontTextConfig ?? {};
  const title =
    typeof (txt as Record<string, unknown>).titleFavorites === "string"
      ? String((txt as Record<string, unknown>).titleFavorites)
      : "Избранное";

  return (
    <div className="faq faq-page favorites-page">
      <h1 className="faq-page__title">❤️ {title}</h1>
      <p className="faq-page__lead">Недавно просмотренные товары</p>
      {recentProducts.length === 0 ? (
        <div className="faq-page__card">
          <p className="faq-page__card-body">
            Откройте товары в каталоге — они появятся здесь.
          </p>
        </div>
      ) : (
        <ul className="favorites-page__list">
          {recentProducts.map((p) => (
            <li key={p.id} className="favorites-page__item">
              <div className="favorites-page__name">{p.name}</div>
              <div className="favorites-page__price">{Math.round(p.price)} сом</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
