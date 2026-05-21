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
import { CommerceDiscoveryFeed } from "./discovery/CommerceDiscoveryFeed";
import { CatalogFooterSlider } from "./sections/CatalogFooterSlider";
import { recordViewCategory } from "./runtime/commerceSession";
import "./storefrontFeed.css";
import "../../storefront/commerceCards.css";
import "../../storefront/motionTokens.css";
import "../../storefront/mobileChrome.css";
import { ProductDetailSheet } from "./product/ProductDetailSheet";
import "./storefrontKits.css";
import {
  buildStorefrontLayoutCssVars,
  kitFromTemplateId,
  storefrontLayoutPresetFromStyleConfig,
  storefrontMotionLevelFromStyleConfig,
} from "../../storefront/buildStorefrontLayoutCssVars";
import {
  defaultCatalogCardPresetForBusinessType,
  mergeStorefrontCardConfigWithResponsive,
  type StorefrontCardViewportTier,
} from "../../storefront/catalogCardPresets";
import { StorefrontFeed } from "./StorefrontFeed";
import { StorefrontIdentityBand } from "./StorefrontIdentityBand";
import { trackStoreView } from "../../services/storefrontAnalytics";

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
  storefrontSlug?: string | null;
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

  const [cardViewportTier, setCardViewportTier] = useState<StorefrontCardViewportTier>("default");

  useEffect(() => {
    const mqMd = window.matchMedia("(min-width: 640px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mqLg.matches) setCardViewportTier("lg");
      else if (mqMd.matches) setCardViewportTier("md");
      else setCardViewportTier("default");
    };
    sync();
    mqMd.addEventListener("change", sync);
    mqLg.addEventListener("change", sync);
    return () => {
      mqMd.removeEventListener("change", sync);
      mqLg.removeEventListener("change", sync);
    };
  }, []);

  const mergedCardConfig = useMemo(
    () => {
      const rawCfg =
        props.payload.storefrontCardConfig &&
        typeof props.payload.storefrontCardConfig === "object"
          ? { ...(props.payload.storefrontCardConfig as Record<string, unknown>) }
          : {};
      if (typeof rawCfg.catalogCardPreset !== "string" || rawCfg.catalogCardPreset.trim() === "") {
        rawCfg.catalogCardPreset = defaultCatalogCardPresetForBusinessType(props.payload.businessType);
      }
      return mergeStorefrontCardConfigWithResponsive(rawCfg, cardViewportTier);
    },
    [props.payload.storefrontCardConfig, cardViewportTier, props.payload.businessType],
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

  useEffect(() => {
    const bid = props.payload.businessId;
    if (!Number.isFinite(bid) || bid <= 0) return;
    trackStoreView(bid);
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

  const firstFeaturedSectionId = useMemo(
    () => sections.find((sec) => sec.type === "featuredProducts")?.id ?? null,
    [sections],
  );
  const hasFeaturedSection = firstFeaturedSectionId != null;

  const styleCfg = props.payload.storefrontStyleConfig as Record<string, unknown> | undefined;
  const layoutPreset = storefrontLayoutPresetFromStyleConfig(styleCfg ?? null);
  const motionLevel = storefrontMotionLevelFromStyleConfig(styleCfg ?? null);
  const brandTone =
    typeof (styleCfg as { brand?: { tone?: unknown } } | undefined)?.brand?.tone === "string"
      ? String((styleCfg as { brand?: { tone?: unknown } }).brand?.tone).trim().toLowerCase()
      : "default";
  const catalogBold =
    styleCfg != null &&
    typeof styleCfg.catalog === "object" &&
    styleCfg.catalog !== null &&
    (styleCfg.catalog as { gridBoost?: string }).gridBoost !== "normal";

  const sliderProductById = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of featuredAll) {
      if (typeof p.id === "number") m.set(p.id, p);
    }
    const cat = catalog ?? [];
    for (const p of cat) {
      if (typeof p.id === "number" && !m.has(p.id)) m.set(p.id, p);
    }
    return m;
  }, [featuredAll, catalog]);

  const showCatalogFooter = useMemo(() => {
    const st = styleCfg?.catalogFooter;
    if (!st || typeof st !== "object") return false;
    if (!(st as { enabled?: boolean }).enabled) return false;
    const slides = (st as { slides?: unknown }).slides;
    if (!Array.isArray(slides) || slides.length === 0) return false;
    return slides.some((row) => {
      if (!row || typeof row !== "object") return false;
      const im = (row as { image?: unknown }).image;
      if (typeof im === "string" && im.trim() !== "") return true;
      const pid = (row as { productId?: unknown }).productId;
      return typeof pid === "number" && pid > 0;
    });
  }, [styleCfg]);

  const identityTextCfg = props.payload.storefrontTextConfig ?? undefined;
  const showIdentityBand = useMemo(() => {
    const storeName = String(props.payload.storeName ?? "").trim();
    const cfg = identityTextCfg as Record<string, unknown> | undefined;
    const keys = [
      "brandTagline",
      "brandPersonality",
      "brandTrust1",
      "brandTrust2",
      "brandTrust3",
      "heroDefaultSubtitle",
    ];
    const hasTextHints = keys.some((k) => typeof cfg?.[k] === "string" && String(cfg[k]).trim() !== "");
    return storeName !== "" || hasTextHints;
  }, [props.payload.storeName, identityTextCfg]);

  return (
    <ThemeVarsProvider theme={theme}>
      <div
        data-sf-kit={kit}
        data-sf-layout={layoutPreset}
        data-sf-motion={motionLevel}
        data-sf-brand-tone={brandTone || "default"}
        className={`sf-root${catalogBold ? " sf-root--catalog-bold" : ""}`}
        style={cssVars as unknown as React.CSSProperties}
      >
        <StorefrontFeed>
          {showIdentityBand ? (
            <div className="sf-feed__chunk sf-feed__chunk--identity sf-feed__chunk--stack">
              <StorefrontIdentityBand
                storeName={props.payload.storeName}
                textConfig={identityTextCfg}
                styleConfig={styleCfg}
              />
            </div>
          ) : null}
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
                      onHeroCta={(ev) => {
                        if (ev.kind === "scrollToSection") {
                          document.getElementById(ev.target)?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                          return;
                        }
                        if (ev.kind === "openCategory") {
                          const id = Number(ev.target);
                          if (Number.isInteger(id) && id > 0) setActiveCategoryId(id);
                          return;
                        }
                        if (ev.kind === "openProduct") {
                          const id = Number(ev.target);
                          const pool = [...(catalog ?? []), ...featuredAll];
                          const p = pool.find((x) => x.id === id);
                          if (p) openProduct(p);
                        }
                      }}
                    />
                  );
                case "promo":
                  return (
                    <PromoSection
                      key={s.id}
                      config={s.config}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                    />
                  );
                case "categories":
                  return (
                    <CategoriesSection
                      key={s.id}
                      config={s.config}
                      categories={props.payload.categories ?? []}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      activeCategoryId={activeCategoryId}
                      onSelectCategory={(id) => {
                        setActiveCategoryId(id);
                        if (id != null) {
                          recordViewCategory({
                            businessId: props.payload.businessId,
                            categoryId: id,
                          });
                        }
                      }}
                    />
                  );
                case "featuredProducts": {
                  const pairDiscovery = s.id === firstFeaturedSectionId;
                  const cfgTitle =
                    typeof s.config.title === "string" && String(s.config.title).trim() !== ""
                      ? String(s.config.title)
                      : typeof props.payload.storefrontTextConfig?.titleHits === "string" &&
                          String(props.payload.storefrontTextConfig.titleHits).trim() !== ""
                        ? String(props.payload.storefrontTextConfig.titleHits)
                        : "Хиты";
                  if (!pairDiscovery) {
                    return (
                      <FeaturedProductsSection
                        config={s.config}
                        products={featuredFiltered}
                        catalogProductCount={featuredAll.length}
                        cardConfig={mergedCardConfig}
                        textConfig={props.payload.storefrontTextConfig ?? undefined}
                        storefrontStyleConfig={styleCfg}
                        kit={kit}
                        businessId={props.payload.businessId}
                        businessType={props.payload.businessType}
                        onOpenProduct={openProduct}
                      />
                    );
                  }
                  return (
                    <CommerceDiscoveryFeed
                      variant="embedded"
                      kit={kit}
                      businessType={props.payload.businessType}
                      businessId={props.payload.businessId}
                      featuredProducts={featuredAll}
                      primaryProducts={featuredFiltered}
                      primaryTitle={cfgTitle}
                      catalogProductCount={featuredAll.length}
                      cardConfig={mergedCardConfig}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      catalogProducts={catalog === null ? [] : catalogFiltered}
                      onOpenProduct={openProduct}
                      catalogBold={catalogBold}
                    />
                  );
                }
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
              <div
                key={s.id}
                id={`sf-sec-${s.id}`}
                className="sf-feed__chunk sf-feed__chunk--section sf-feed__chunk--stack"
                data-sf-section-type={s.type}
              >
                {chunk}
              </div>
            );
          })}

          {!hasFeaturedSection && catalog !== null ? (
            <div className="sf-feed__chunk sf-feed__chunk--commerce sf-feed__chunk--stack">
              <CommerceDiscoveryFeed
                variant="standalone"
                kit={kit}
                businessType={props.payload.businessType}
                businessId={props.payload.businessId}
                featuredProducts={featuredFiltered}
                primaryProducts={featuredFiltered}
                primaryTitle={
                  typeof props.payload.storefrontTextConfig?.titleHits === "string" &&
                  String(props.payload.storefrontTextConfig.titleHits).trim() !== ""
                    ? String(props.payload.storefrontTextConfig.titleHits)
                    : "Каталог"
                }
                catalogProductCount={featuredAll.length || catalogFiltered.length}
                cardConfig={mergedCardConfig}
                textConfig={props.payload.storefrontTextConfig ?? undefined}
                catalogProducts={catalogFiltered}
                onOpenProduct={openProduct}
                catalogBold={catalogBold}
              />
            </div>
          ) : null}

          {showCatalogFooter ? (
            <div className="sf-feed__chunk sf-feed__chunk--catalog-footer sf-feed__chunk--stack">
              <CatalogFooterSlider
                storefrontStyleConfig={styleCfg}
                productById={sliderProductById}
                onOpenProduct={openProduct}
              />
            </div>
          ) : null}
        </StorefrontFeed>
      </div>

      {sheetProduct ? (
        <ProductDetailSheet
          product={sheetProduct}
          businessId={props.payload.businessId}
          businessType={props.payload.businessType ?? undefined}
          featuredProducts={featuredAll}
          catalogProducts={catalog ?? []}
          onClose={() => setSheetProduct(null)}
          onSelectProduct={setSheetProduct}
        />
      ) : null}
    </ThemeVarsProvider>
  );
}
