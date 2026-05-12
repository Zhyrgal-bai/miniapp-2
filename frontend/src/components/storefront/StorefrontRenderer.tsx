import { useMemo } from "react";
import type { Category, Product } from "../../types";
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
import "./storefrontKits.css";
import {
  buildStorefrontLayoutCssVars,
  kitFromTemplateId,
} from "../../storefront/buildStorefrontLayoutCssVars";

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
        {sections.map((s) => {
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
