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
  businessType: string;
  templateId: string | null;
  storefrontConfigVersion: number;
  sections: ResolvedStorefrontSection[];
  categories?: Category[];
  featuredProducts?: Product[];
};

export function StorefrontRenderer(props: {
  payload: ResolvedStorefrontPayload;
}): React.ReactElement {
  const { theme } = useTheme();

  const sections = useMemo(() => {
    const s = Array.isArray(props.payload.sections) ? props.payload.sections : [];
    return [...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [props.payload.sections]);

  return (
    <ThemeVarsProvider theme={theme}>
      {sections.map((s) => {
        switch (s.type) {
          case "hero":
            return <HeroSection key={s.id} config={s.config} />;
          case "promo":
            return <PromoSection key={s.id} config={s.config} />;
          case "categories":
            return (
              <CategoriesSection
                key={s.id}
                config={s.config}
                categories={props.payload.categories ?? []}
              />
            );
          case "featuredProducts":
            return (
              <FeaturedProductsSection
                key={s.id}
                config={s.config}
                products={props.payload.featuredProducts ?? []}
              />
            );
          case "footer":
            return <FooterSection key={s.id} config={s.config} />;
          case "reviews":
            return <ReviewsSection key={s.id} config={s.config} />;
          case "faq":
            return <FaqSection key={s.id} config={s.config} />;
          default:
            return null;
        }
      })}
    </ThemeVarsProvider>
  );
}

