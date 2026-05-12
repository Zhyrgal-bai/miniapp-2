import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "../../../types";
import { api } from "../../../services/api";
import { buildDiscoveryRails } from "./discoveryFeedRegistry";
import ProductCard from "../../product/ProductCard";

type Props = {
  kit: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessType: string;
  businessId: number;
  featuredProducts: Product[];
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  /** Если задан (включая пустой массив) — внутренний GET /products не выполняется. */
  catalogProducts?: Product[] | null;
  onOpenProduct?: (product: Product) => void;
};

export function DiscoveryRails(props: Props): React.ReactElement | null {
  const [fetchedCatalog, setFetchedCatalog] = useState<Product[] | null>(null);

  useEffect(() => {
    if (props.catalogProducts !== undefined) return;
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<Product[]>("/products");
        if (!alive) return;
        setFetchedCatalog(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!alive) return;
        setFetchedCatalog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.catalogProducts]);

  const rails = useMemo(() => {
    const catalogProducts =
      props.catalogProducts !== undefined
        ? props.catalogProducts ?? []
        : fetchedCatalog ?? [];
    return buildDiscoveryRails({
      kit: props.kit,
      businessType: props.businessType,
      businessId: props.businessId,
      featuredProducts: props.featuredProducts ?? [],
      catalogProducts,
      textConfig: props.textConfig,
    });
  }, [
    props.kit,
    props.businessType,
    props.businessId,
    props.featuredProducts,
    props.textConfig,
    props.catalogProducts,
    fetchedCatalog,
  ]);

  if (!rails.length) return null;

  return (
    <section className="sf-section sf-section--discovery sf-section--padded">
      <div className="sf-section-grid sf-section-grid--md">
        {rails.map((r) => (
          <div key={r.id}>
            <div className="sf-section__title">{r.title}</div>
            <div className="sf-rail" role="list">
              {r.products.map((p) => (
                <div key={String(p.id)} className="sf-rail__item" role="listitem">
                  <ProductCard
                    product={p}
                    showToast={() => undefined}
                    onOpenDetail={props.onOpenProduct}
                    cardConfig={props.cardConfig}
                    textConfig={props.textConfig}
                    kit={props.kit}
                    businessId={props.businessId}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

