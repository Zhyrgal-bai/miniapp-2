import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, Product } from "../../types";
import { api, TENANT_HEADER } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { ThemeVarsProvider } from "./theme/ThemeVarsProvider";
import { HeroSection } from "./sections/HeroSection";
import { PromoSection } from "./sections/PromoSection";
import { CategoriesSection } from "./sections/CategoriesSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { FooterSection } from "./sections/FooterSection";
import { ReviewsSection } from "./sections/ReviewsSection";
import { FaqSection } from "./sections/FaqSection";
import { DiscoveryRails } from "./discovery/DiscoveryRails";
import { ProductDetailSheet } from "./product/ProductDetailSheet";
import "./storefrontKits.css";
import {
  buildStorefrontLayoutCssVars,
  kitFromTemplateId,
} from "../../storefront/buildStorefrontLayoutCssVars";
import { mergeStorefrontCardConfigWithPreset } from "../../storefront/catalogCardPresets";

type StorefrontKitId = "minimal" | "luxury" | "fashion" | "neon" | "default";

export type StorefrontSectionType =
  | "hero"
  | "promo"
  | "categories"
  | "featuredProducts"
  | "footer"
  | "reviews"
  | "faq"
  | "countdown"
  | "storySlider"
  | "videoBanner";

export type ResolvedStorefrontSection = {
  id: string;
  type: StorefrontSectionType;
  order: number;
  config: Record<string, unknown>;
};

export type ResolvedStorefrontPayload = {
  businessId: number;
  storeName?: string;
  businessType: string;
  templateId: string | null;
  storefrontConfigVersion: number;
  sections: ResolvedStorefrontSection[];
  storefrontHeaderConfig?: Record<string, unknown>;
  storefrontCardConfig?: Record<string, unknown>;
  storefrontTextConfig?: Record<string, unknown>;
  storefrontStyleConfig?: Record<string, unknown>;
  categories?: Category[];
  featuredProducts?: Product[];
};

export function StorefrontRenderer(props: {
  payload: ResolvedStorefrontPayload;
}): React.ReactElement {
  const { theme } = useTheme();
  const kit = kitFromTemplateId(props.payload.templateId) as StorefrontKitId;
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const mergedCardConfig = useMemo(
    () => mergeStorefrontCardConfigWithPreset(props.payload.storefrontCardConfig ?? undefined),
    [props.payload.storefrontCardConfig],
  );

  const filterByCategory = useCallback(
    (list: Product[]) => {
      if (activeCategoryId == null) return list;
      return list.filter((p) => p.categoryId === activeCategoryId);
    },
    [activeCategoryId],
  );

  const featuredAll = useMemo(
    () => props.payload.featuredProducts ?? [],
    [props.payload.featuredProducts],
  );
  const featuredFiltered = useMemo(
    () => filterByCategory(featuredAll),
    [featuredAll, filterByCategory],
  );

  const catalogFiltered = useMemo(
    () => filterByCategory(catalog ?? []),
    [catalog, filterByCategory],
  );

  useEffect(() => {
    const bid = props.payload.businessId;
    if (!Number.isFinite(bid) || bid <= 0) {
      setCatalog([]);
      return;
    }
    let alive = true;
    setCatalog(null);
    void (async () => {
      try {
        const res = await api.get<Product[]>("/products", {
          headers: { [TENANT_HEADER]: String(bid) },
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
  }, [props.payload.businessId]);

  useEffect(() => {
    setSheetProduct(null);
    setActiveCategoryId(null);
  }, [props.payload.businessId]);

  const openProduct = useCallback((p: Product) => {
    setSheetProduct(p);
  }, []);

  useEffect(() => {
    if (sheetProduct) {
      window.dispatchEvent(new CustomEvent("sf:productSheetOpen"));
    } else {
      window.dispatchEvent(new CustomEvent("sf:productSheetClose"));
    }
  }, [sheetProduct]);

  const cssVars = useMemo(
    () =>
      buildStorefrontLayoutCssVars(
        (props.payload.storefrontStyleConfig ?? null) as Record<string, unknown> | null,
      ),
    [props.payload.storefrontStyleConfig],
  );

  const sections = useMemo(() => {
    const s = Array.isArray(props.payload.sections) ? props.payload.sections : [];
    return [...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [props.payload.sections]);

  return (
    <ThemeVarsProvider theme={theme}>
      <div data-sf-kit={kit} className="sf-root" style={cssVars as unknown as React.CSSProperties}>
        <div className="sf-feed" data-sf-feed>
          {sections.map((s) => {
            const chunk = (() => {
              switch (s.type) {
                case "hero":
                  return (
                    <HeroSection
                      key={s.id}
                      config={s.config}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      kit={kit}
                      heroStyle={(props.payload.storefrontStyleConfig as Record<string, unknown> | undefined)?.hero as
                        | Record<string, unknown>
                        | undefined}
                    />
                  );
                case "promo":
                  return <PromoSection key={s.id} config={s.config} />;
                case "categories":
                  return (
                    <CategoriesSection
                      key={s.id}
                      config={s.config}
                      categories={props.payload.categories ?? []}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      activeCategoryId={activeCategoryId}
                      onSelectCategory={setActiveCategoryId}
                    />
                  );
                case "featuredProducts":
                  return (
                    <FeaturedProductsSection
                      key={s.id}
                      config={s.config}
                      products={featuredFiltered}
                      catalogProductCount={featuredAll.length}
                      cardConfig={mergedCardConfig}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      kit={kit}
                      businessId={props.payload.businessId}
                      onOpenProduct={openProduct}
                    />
                  );
                case "footer":
                  return <FooterSection key={s.id} config={s.config} />;
                case "reviews":
                  return (
                    <ReviewsSection
                      key={s.id}
                      config={s.config}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                    />
                  );
                case "faq":
                  return (
                    <FaqSection
                      key={s.id}
                      config={s.config}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                    />
                  );
                default:
                  return null;
              }
            })();
            if (chunk == null) return null;
            return (
              <div key={s.id} className="sf-feed__chunk sf-feed__chunk--section">
                {chunk}
              </div>
            );
          })}

          <div className="sf-feed__chunk sf-feed__chunk--discovery">
            <DiscoveryRails
              kit={kit}
              businessType={props.payload.businessType}
              businessId={props.payload.businessId}
              featuredProducts={featuredFiltered}
              cardConfig={mergedCardConfig}
              textConfig={props.payload.storefrontTextConfig ?? undefined}
              catalogProducts={catalog === null ? undefined : catalogFiltered}
              onOpenProduct={openProduct}
            />
          </div>
        </div>
      </div>

      {sheetProduct ? (
        <ProductDetailSheet
          product={sheetProduct}
          businessId={props.payload.businessId}
          featuredProducts={featuredAll}
          catalogProducts={catalog ?? []}
          onClose={() => setSheetProduct(null)}
          onSelectProduct={setSheetProduct}
        />
      ) : null}
    </ThemeVarsProvider>
  );
}
