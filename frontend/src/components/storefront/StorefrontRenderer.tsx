import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CatalogFooterSlider, catalogFooterCanShow } from "./sections/CatalogFooterSlider";
import { recordViewCategory } from "./runtime/commerceSession";
import "./storefrontFeed.css";
import "../../storefront/commerceCards.css";
import "../../storefront/motionTokens.css";
import "../../storefront/mobileChrome.css";
import { ProductModalHost } from "./product/host/ProductModalHost";
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
import { applyImagePresentationForBusinessType } from "../../storefront/imagePresentationPresets";
import { storefrontVerticalExperience } from "../../storefront/verticalExperience";
import { resolveCatalogBehavior } from "../../storefront/templates/templateRegistry";
import { StorefrontFeed } from "./StorefrontFeed";
import { CatalogSearchBar } from "./CatalogSearchBar";
import { StorefrontCompactStrip } from "./StorefrontCompactStrip";
import "./StorefrontCompactStrip.css";
import "./catalogSearchBar.css";
import { filterProductsBySearch } from "../../utils/filterProductsBySearch";
import { getStorefrontCommerceMode } from "../../hooks/useStorefrontCommerceMode";
import { WebStorefrontInfoBar } from "./commerce/WebStorefrontInfoBar";
import { WebShowcaseHeader } from "./web/WebShowcaseHeader";
import { WebShowcaseAbout } from "./web/WebShowcaseAbout";
import { WebShowcaseContacts } from "./web/WebShowcaseContacts";
import { WebShowcaseFooter } from "./web/WebShowcaseFooter";
import { trackStoreView } from "../../services/storefrontAnalytics";
import { enrichProductsFromCatalog } from "../../utils/enrichProductsFromCatalog";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { TableBookingCta } from "../tableBooking/TableBookingCta";
import "../tableBooking/tableBooking.css";
import type { PublicStoreAvailability } from "@repo-shared/storeAvailabilitySettings";

type StorefrontKitId = "minimal" | "luxury" | "fashion" | "neon" | "default";

const FEED_SECTION_PRIORITY: Partial<Record<StorefrontSectionType, number>> = {
  categories: 10,
  promo: 20,
  hero: 30,
  featuredProducts: 40,
  reviews: 50,
  faq: 60,
  footer: 70,
};

function openStoreProfile(): void {
  window.dispatchEvent(new CustomEvent("sf:openStoreProfile"));
}

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

export type StorefrontFeaturedPromo = {
  code: string;
  discount: number;
  remainingUses: number;
};

export type StorefrontStoreAddress = {
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
};

export type StorefrontDeliveryPolicy = {
  pricingMode:
    | "SELF_PICKUP"
    | "FIXED_PRICE"
    | "DISTANCE_BASED"
    | "FREE_DELIVERY"
    | "MANUAL_CONFIRMATION";
  minOrderAmountSom: number;
  fixedPriceSom: number;
  distanceTiers: Array<{ maxKm: number | null; priceSom: number }>;
  manualConfirmationNotice: string | null;
  pickupOnly: boolean;
};

export type ResolvedStorefrontPayload = {
  businessId: number;
  storefrontSlug?: string | null;
  storeName?: string;
  storeAddress?: StorefrontStoreAddress;
  telegramOpenUrl?: string;
  deliveryPolicy?: StorefrontDeliveryPolicy;
  storeAvailability?: PublicStoreAvailability;
  deliveryEta?: PublicStoreAvailability["deliveryEta"];
  pickupEta?: PublicStoreAvailability["pickupEta"];
  deliveryZones?: PublicStoreAvailability["deliveryZones"];
  businessType: string;
  templateId: string | null;
  featureFlags?: {
    enableStories?: boolean;
    enableReviews?: boolean;
    enableVideo?: boolean;
    enableProductModalV3?: boolean;
    enableLifetimeAnalyticsV2?: boolean;
  };
  storefrontConfigVersion: number;
  sections: ResolvedStorefrontSection[];
  storefrontHeaderConfig?: Record<string, unknown>;
  storefrontCardConfig?: Record<string, unknown>;
  storefrontTextConfig?: Record<string, unknown>;
  storefrontStyleConfig?: Record<string, unknown>;
  categories?: Category[];
  finikCheckoutReady?: boolean;
  featuredProducts?: Product[];
  featuredPromo?: StorefrontFeaturedPromo | null;
  orderOptionsSchema?: Record<string, unknown>;
  merchantConfig?: Record<string, unknown>;
  templateDescriptor?: Record<string, unknown>;
  webProfile?: {
    coverUrl: string | null;
    slogan: string | null;
    story: string | null;
    accentColor: string | null;
    social: {
      instagram: string | null;
      telegram: string | null;
      whatsapp: string | null;
      website: string | null;
    };
  };
};

type CategoryNode = {
  id: number;
  name: string;
  parentId?: number | null;
  children?: CategoryNode[];
};

function collectCategoryIds(node: CategoryNode): Set<number> {
  const ids = new Set<number>();
  const walk = (n: CategoryNode) => {
    ids.add(n.id);
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return ids;
}

function findCategoryNode(
  categories: CategoryNode[],
  id: number,
): CategoryNode | null {
  for (const c of categories) {
    if (c.id === id) return c;
    const nested = findCategoryNode(c.children ?? [], id);
    if (nested != null) return nested;
  }
  return null;
}

function categoryFilterIds(
  categories: CategoryNode[] | undefined,
  activeCategoryId: number,
): Set<number> {
  const node = findCategoryNode(categories ?? [], activeCategoryId);
  if (node == null) return new Set([activeCategoryId]);
  return collectCategoryIds(node);
}

export function StorefrontRenderer(props: {
  payload: ResolvedStorefrontPayload;
}): React.ReactElement {
  const { theme } = useTheme();
  const kit = kitFromTemplateId(props.payload.templateId) as StorefrontKitId;
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const activeProductRef = useRef<Product | null>(null);
  activeProductRef.current = activeProduct;
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      const behavior = resolveCatalogBehavior({
        businessType: props.payload.businessType,
        templateDescriptor: props.payload.templateDescriptor ?? null,
      });
      const rawCfg =
        props.payload.storefrontCardConfig &&
        typeof props.payload.storefrontCardConfig === "object"
          ? { ...(props.payload.storefrontCardConfig as Record<string, unknown>) }
          : {};
      if (typeof rawCfg.cardHint !== "string" || rawCfg.cardHint.trim() === "") {
        rawCfg.cardHint = behavior.cardPlaceholder;
      }
      if (typeof rawCfg.imageRatio !== "string" || rawCfg.imageRatio.trim() === "") {
        rawCfg.imageRatio = behavior.imageRatioHint;
      }
      if (typeof rawCfg.imageFit !== "string" || rawCfg.imageFit.trim() === "") {
        rawCfg.imageFit = behavior.imageFitHint;
      }
      if (typeof rawCfg.catalogCardPreset !== "string" || rawCfg.catalogCardPreset.trim() === "") {
        rawCfg.catalogCardPreset = defaultCatalogCardPresetForBusinessType(props.payload.businessType);
      }
      const merged = mergeStorefrontCardConfigWithResponsive(rawCfg, cardViewportTier);
      return applyImagePresentationForBusinessType(merged, props.payload.businessType, rawCfg);
    },
    [
      props.payload.storefrontCardConfig,
      props.payload.businessType,
      props.payload.templateDescriptor,
      cardViewportTier,
    ],
  );

  const verticalExperience = useMemo(
    () => storefrontVerticalExperience(props.payload.businessType),
    [props.payload.businessType],
  );

  const commerceMode = getStorefrontCommerceMode();
  const isWebBrowse = commerceMode === "web";
  const showTableBooking =
    !isWebBrowse &&
    businessTypeSupportsTableReservations(props.payload.businessType);

  const openTableBooking = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sf:openTableBooking"));
  }, []);

  const filterByCategory = useCallback(
    (list: Product[]) => {
      if (activeCategoryId == null) return list;
      const allowed = categoryFilterIds(
        props.payload.categories as CategoryNode[] | undefined,
        activeCategoryId,
      );
      return list.filter(
        (p) => p.categoryId != null && allowed.has(Number(p.categoryId)),
      );
    },
    [activeCategoryId, props.payload.categories],
  );

  const filterCatalog = useCallback(
    (list: Product[]) => filterProductsBySearch(filterByCategory(list), searchQuery),
    [filterByCategory, searchQuery],
  );

  const featuredAll = useMemo(
    () =>
      enrichProductsFromCatalog(
        props.payload.featuredProducts ?? [],
        catalog,
      ),
    [props.payload.featuredProducts, catalog],
  );
  const featuredFiltered = useMemo(
    () => filterCatalog(featuredAll),
    [featuredAll, filterCatalog],
  );

  const catalogFiltered = useMemo(
    () => filterCatalog(catalog ?? []),
    [catalog, filterCatalog],
  );

  const catalogForRails = useMemo(
    () => filterByCategory(catalog ?? []),
    [catalog, filterByCategory],
  );

  /** Footer rail: full catalog when loaded, else featured from payload (same as admin preview). */
  const footerSliderProducts = useMemo(() => {
    const merged = new Map<number, Product>();
    const featured = enrichProductsFromCatalog(
      props.payload.featuredProducts ?? [],
      catalog,
    );
    for (const p of featured) {
      const id = Number(p.id ?? 0);
      if (id > 0) merged.set(id, p);
    }
    if (catalog != null) {
      for (const p of catalog) {
        const id = Number(p.id ?? 0);
        if (id > 0) merged.set(id, p);
      }
    }
    return Array.from(merged.values());
  }, [catalog, props.payload.featuredProducts]);

  const primaryDisplayProducts = useMemo(() => {
    if (featuredFiltered.length > 0) return featuredFiltered;
    return catalogFiltered;
  }, [featuredFiltered, catalogFiltered]);

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
    setActiveProduct(null);
    setActiveCategoryId(null);
    setSearchQuery("");
  }, [props.payload.businessId]);

  useEffect(() => {
    const bid = props.payload.businessId;
    if (!Number.isFinite(bid) || bid <= 0) return;
    trackStoreView(bid);
  }, [props.payload.businessId]);

  const catalogScrollYRef = useRef(0);

  const openProduct = useCallback((p: Product) => {
    const root = document.querySelector<HTMLElement>(
      ".sf-root.sf-app[data-sf-scroll-root]",
    );
    catalogScrollYRef.current = root?.scrollTop ?? window.scrollY;
    setActiveProduct(p);
  }, []);

  const closeProduct = useCallback(() => {
    setActiveProduct(null);
  }, []);

  useEffect(() => {
    if (activeProduct != null) return;
    const y = catalogScrollYRef.current;
    if (y <= 0) return;
    const root = document.querySelector<HTMLElement>(
      ".sf-root.sf-app[data-sf-scroll-root]",
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (root) root.scrollTop = y;
        else window.scrollTo(0, y);
      });
    });
  }, [activeProduct]);

  useEffect(() => {
    if (activeProduct) {
      window.dispatchEvent(new CustomEvent("sf:productExperienceOpen"));
    } else {
      window.dispatchEvent(new CustomEvent("sf:productExperienceClose"));
    }
  }, [activeProduct]);

  useEffect(() => {
    const onExternalClose = () => closeProduct();
    window.addEventListener("sf:productExperienceClose", onExternalClose);
    return () => {
      window.removeEventListener("sf:productExperienceClose", onExternalClose);
      if (activeProductRef.current != null) {
        window.dispatchEvent(new CustomEvent("sf:productExperienceClose"));
      }
    };
  }, [closeProduct]);

  const cssVars = useMemo(
    () =>
      buildStorefrontLayoutCssVars(
        (props.payload.storefrontStyleConfig ?? null) as Record<string, unknown> | null,
      ),
    [props.payload.storefrontStyleConfig],
  );

  const sections = useMemo(() => {
    const s = Array.isArray(props.payload.sections) ? props.payload.sections : [];
    return [...s].sort((a, b) => {
      const pa = FEED_SECTION_PRIORITY[a.type] ?? 99;
      const pb = FEED_SECTION_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [props.payload.sections]);

  const categoriesSection = useMemo(
    () => sections.find((sec) => sec.type === "categories") ?? null,
    [sections],
  );

  const feedSections = useMemo(
    () =>
      sections.filter(
        (sec) =>
          sec.type !== "categories" &&
          sec.type !== "footer" &&
          sec.type !== "reviews" &&
          sec.type !== "faq",
      ),
    [sections],
  );

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

  const showCatalogFooter = useMemo(() => {
    const st = styleCfg?.catalogFooter;
    if (!st || typeof st !== "object") return false;
    const enabled = Boolean((st as { enabled?: boolean }).enabled);
    return catalogFooterCanShow(enabled, footerSliderProducts);
  }, [styleCfg, footerSliderProducts]);

  const identityTextCfg = props.payload.storefrontTextConfig ?? undefined;
  const searchPlaceholder =
    typeof identityTextCfg?.searchPlaceholder === "string" &&
    String(identityTextCfg.searchPlaceholder).trim() !== ""
      ? String(identityTextCfg.searchPlaceholder)
      : "Поиск товаров…";
  const catalogLoading = catalog === null;

  return (
    <ThemeVarsProvider theme={theme}>
      <div
        data-sf-kit={kit}
        data-sf-layout={layoutPreset}
        data-sf-motion={motionLevel}
        data-sf-brand-tone={brandTone || "default"}
        data-sf-vertical={verticalExperience !== "default" ? verticalExperience : undefined}
        className={`sf-root${catalogBold ? " sf-root--catalog-bold" : ""}${activeProduct ? " sf-root--quick-view-open" : ""}`}
        style={cssVars as unknown as React.CSSProperties}
      >
        <StorefrontFeed>
          <div className="sf-feed__chunk sf-feed__chunk--compact sf-feed__chunk--stack">
            <StorefrontCompactStrip
              businessId={props.payload.businessId}
              storeName={props.payload.storeName}
              storeCity={props.payload.storeAddress?.city}
              availability={props.payload.storeAvailability ?? null}
              onOpenProfile={openStoreProfile}
            />
          </div>
          <div className="sf-feed__chunk sf-feed__chunk--search sf-feed__chunk--stack sf-feed__chunk--sticky-search">
            <CatalogSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
              onClear={() => setActiveCategoryId(null)}
            />
          </div>
          {categoriesSection && (props.payload.categories?.length ?? 0) > 0 ? (
            <div className="sf-feed__chunk sf-feed__chunk--categories sf-feed__chunk--stack">
              <CategoriesSection
                compact
                config={categoriesSection.config}
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
            </div>
          ) : null}
          {isWebBrowse ? (
            <div className="sf-feed__chunk sf-feed__chunk--web-showcase sf-feed__chunk--stack">
              <WebShowcaseHeader
                storeName={props.payload.storeName}
                city={props.payload.storeAddress?.city ?? null}
                profile={props.payload.webProfile ?? null}
              />
            </div>
          ) : null}
          {isWebBrowse ? (
            <div className="sf-feed__chunk sf-feed__chunk--web-info sf-feed__chunk--stack">
              <WebStorefrontInfoBar
                storeName={props.payload.storeName}
                storeAddress={props.payload.storeAddress}
                telegramOpenUrl={props.payload.telegramOpenUrl ?? null}
              />
            </div>
          ) : null}
          {isWebBrowse ? (
            <div className="sf-feed__chunk sf-feed__chunk--web-about sf-feed__chunk--stack">
              <WebShowcaseAbout profile={props.payload.webProfile ?? null} />
              <WebShowcaseContacts
                profile={props.payload.webProfile ?? null}
                storeAddress={props.payload.storeAddress ?? null}
                telegramOpenUrl={props.payload.telegramOpenUrl ?? null}
              />
            </div>
          ) : null}
          {showTableBooking ? (
            <div className="sf-feed__chunk sf-feed__chunk--booking-cta sf-section--padded">
              <TableBookingCta onPress={openTableBooking} />
            </div>
          ) : null}
          {feedSections.map((s) => {
            const chunk = (() => {
              switch (s.type) {
                case "hero":
                  return (
                    <HeroSection
                      key={s.id}
                      config={s.config}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      featuredPromo={props.payload.featuredPromo ?? null}
                      kit={kit}
                      storefrontSlug={props.payload.storefrontSlug}
                      storeName={props.payload.storeName}
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
                  return null;
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
                        templateDescriptor={props.payload.templateDescriptor ?? null}
                        onOpenProduct={openProduct}
                      />
                    );
                  }
                  return (
                    <CommerceDiscoveryFeed
                      variant="embedded"
                      kit={kit}
                      businessType={props.payload.businessType}
                      templateDescriptor={props.payload.templateDescriptor ?? null}
                      businessId={props.payload.businessId}
                      featuredProducts={featuredAll}
                      primaryProducts={featuredFiltered}
                      primaryTitle={cfgTitle}
                      catalogProductCount={featuredAll.length}
                      cardConfig={mergedCardConfig}
                      textConfig={props.payload.storefrontTextConfig ?? undefined}
                      catalogProducts={catalogForRails}
                      onOpenProduct={openProduct}
                      catalogBold={catalogBold}
                      searchQuery={searchQuery}
                      catalogLoading={catalogLoading}
                      onClearFilters={() => {
                        setSearchQuery("");
                        setActiveCategoryId(null);
                      }}
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

          {(!hasFeaturedSection && (catalog !== null || catalogLoading)) ? (
            <div className="sf-feed__chunk sf-feed__chunk--commerce sf-feed__chunk--stack">
              <CommerceDiscoveryFeed
                variant="standalone"
                kit={kit}
                businessType={props.payload.businessType}
                templateDescriptor={props.payload.templateDescriptor ?? null}
                businessId={props.payload.businessId}
                featuredProducts={featuredAll}
                primaryProducts={primaryDisplayProducts}
                primaryTitle={
                  typeof props.payload.storefrontTextConfig?.titleHits === "string" &&
                  String(props.payload.storefrontTextConfig.titleHits).trim() !== ""
                    ? String(props.payload.storefrontTextConfig.titleHits)
                    : "Каталог"
                }
                catalogProductCount={Math.max(featuredAll.length, catalog?.length ?? 0)}
                cardConfig={mergedCardConfig}
                textConfig={props.payload.storefrontTextConfig ?? undefined}
                catalogProducts={catalogForRails}
                onOpenProduct={openProduct}
                catalogBold={catalogBold}
                searchQuery={searchQuery}
                catalogLoading={catalogLoading}
                onClearFilters={() => {
                  setSearchQuery("");
                  setActiveCategoryId(null);
                }}
              />
            </div>
          ) : null}

          {showCatalogFooter ? (
            <div className="sf-feed__chunk sf-feed__chunk--catalog-footer sf-feed__chunk--stack">
              <CatalogFooterSlider
                storefrontStyleConfig={styleCfg}
                catalogProducts={footerSliderProducts}
                onOpenProduct={openProduct}
              />
            </div>
          ) : null}

          {isWebBrowse ? (
            <div className="sf-feed__chunk sf-feed__chunk--web-footer sf-feed__chunk--stack">
              <WebShowcaseFooter telegramOpenUrl={props.payload.telegramOpenUrl ?? null} />
            </div>
          ) : null}
        </StorefrontFeed>

        <ProductModalHost
          open={activeProduct != null}
          product={activeProduct}
          businessId={props.payload.businessId}
          businessType={props.payload.businessType ?? undefined}
          templateDescriptor={props.payload.templateDescriptor ?? null}
          modalV3Enabled={props.payload.featureFlags?.enableProductModalV3 !== false}
          catalogProducts={catalog ?? []}
          onClose={closeProduct}
          onSelectProduct={openProduct}
        />
      </div>
    </ThemeVarsProvider>
  );
}
