import { useMemo } from "react";
import type { Category, Product } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { ThemeVarsProvider } from "./theme/ThemeVarsProvider";
import { StorefrontHeader } from "./header/StorefrontHeader";
import { HeroSection } from "./sections/HeroSection";
import { PromoSection } from "./sections/PromoSection";
import { CategoriesSection } from "./sections/CategoriesSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { FooterSection } from "./sections/FooterSection";
import { ReviewsSection } from "./sections/ReviewsSection";
import { FaqSection } from "./sections/FaqSection";
import { DiscoveryRails } from "./discovery/DiscoveryRails";
import "./storefrontKits.css";

type StorefrontKitId = "minimal" | "luxury" | "fashion" | "neon" | "default";

function kitFromTemplateId(tid: string | null | undefined): StorefrontKitId {
  const t = typeof tid === "string" ? tid.trim().toLowerCase() : "";
  if (t === "minimal" || t === "light") return "minimal";
  if (t === "luxury") return "luxury";
  if (t === "fashion") return "fashion";
  if (t === "neon") return "neon";
  return "default";
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
  const kit = kitFromTemplateId(props.payload.templateId);
  const styleCfg = props.payload.storefrontStyleConfig ?? {};
  const layout = (styleCfg.layout && typeof styleCfg.layout === "object" ? (styleCfg.layout as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const typo = (styleCfg.typography && typeof styleCfg.typography === "object"
    ? (styleCfg.typography as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const chips = (styleCfg.chips && typeof styleCfg.chips === "object" ? (styleCfg.chips as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const buttons = (styleCfg.buttons && typeof styleCfg.buttons === "object"
    ? (styleCfg.buttons as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const hero = (styleCfg.hero && typeof styleCfg.hero === "object" ? (styleCfg.hero as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  const cssVars: Record<string, string> = {
    "--sf-section-pad": typeof layout.sectionSpacing === "number" ? `${layout.sectionSpacing}px` : "",
    "--sf-grid-gap": typeof layout.productGap === "number" ? `${layout.productGap}px` : "",
    "--sf-mobile-pad": typeof layout.mobilePadding === "number" ? `${layout.mobilePadding}px` : "",

    "--sf-typo-title-size": typeof typo.titleSize === "number" ? `${typo.titleSize}px` : "",
    "--sf-typo-section-title-size": typeof typo.sectionTitleSize === "number" ? `${typo.sectionTitleSize}px` : "",
    "--sf-typo-button-size": typeof typo.buttonSize === "number" ? `${typo.buttonSize}px` : "",
    "--sf-typo-title-weight": typeof typo.titleWeight === "number" ? String(typo.titleWeight) : "",
    "--sf-typo-title-transform":
      typeof typo.uppercaseTitles === "boolean" ? (typo.uppercaseTitles ? "uppercase" : "none") : "",
    "--sf-typo-title-letter-spacing": typeof typo.letterSpacing === "number" ? `${typo.letterSpacing}em` : "",
    "--sf-typo-title-line-height": typeof typo.lineHeight === "number" ? String(typo.lineHeight) : "",

    "--sf-chip-radius": typeof chips.radius === "number" ? `${chips.radius}px` : "",
    "--sf-chip-gap": typeof chips.gap === "number" ? `${chips.gap}px` : "",

    "--sf-button-radius": typeof buttons.radius === "number" ? `${buttons.radius}px` : "",
    "--sf-button-height": typeof buttons.height === "number" ? `${buttons.height}px` : "",

    "--sf-hero-height": typeof hero.height === "number" ? `${hero.height}px` : "",
    "--sf-hero-radius": typeof hero.radius === "number" ? `${hero.radius}px` : "",
  };

  const sections = useMemo(() => {
    const s = Array.isArray(props.payload.sections) ? props.payload.sections : [];
    return [...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [props.payload.sections]);

  return (
    <ThemeVarsProvider theme={theme}>
      <div data-sf-kit={kit} className="sf-root" style={cssVars as unknown as React.CSSProperties}>
        <StorefrontHeader
          theme={theme}
          storeName={props.payload.storeName ?? null}
          config={props.payload.storefrontHeaderConfig ?? undefined}
          kit={kit}
        />
        {sections.map((s) => {
          switch (s.type) {
            case "hero":
              return (
                <HeroSection
                  key={s.id}
                  config={s.config}
                  textConfig={props.payload.storefrontTextConfig ?? undefined}
                  kit={kit}
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
                />
              );
            case "featuredProducts":
              return (
                <FeaturedProductsSection
                  key={s.id}
                  config={s.config}
                  products={props.payload.featuredProducts ?? []}
                  cardConfig={props.payload.storefrontCardConfig ?? undefined}
                  textConfig={props.payload.storefrontTextConfig ?? undefined}
                kit={kit}
                  businessId={props.payload.businessId}
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
        })}

        <DiscoveryRails
          kit={kit}
          businessType={props.payload.businessType}
          businessId={props.payload.businessId}
          featuredProducts={props.payload.featuredProducts ?? []}
          cardConfig={props.payload.storefrontCardConfig ?? undefined}
          textConfig={props.payload.storefrontTextConfig ?? undefined}
        />
      </div>
    </ThemeVarsProvider>
  );
}

