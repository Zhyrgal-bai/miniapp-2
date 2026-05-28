import { useCallback, useMemo, type ReactElement } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  formatFeaturedPromoLine,
  type FeaturedPromo,
} from "../../../storefront/featuredPromo";
import { parseHeroShowcaseSettings } from "../../../storefront/heroShowcaseSettings";
import {
  ShowcaseMarqueeHero,
  type ShowcaseMarqueeSlide,
} from "./ShowcaseMarqueeHero";

export type HeroCtaPayload = {
  kind: "scrollToSection" | "openCategory" | "openProduct" | "url" | "none";
  target: string;
};

function readString(obj: unknown, key: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return "";
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function readTextConfigString(cfg: unknown, key: string): string {
  if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) return "";
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function readSlides(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.slides;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

function slideHasContent(s: Record<string, unknown>): boolean {
  return (
    readString(s, "title").trim() !== "" ||
    readString(s, "subtitle").trim() !== "" ||
    readString(s, "imageUrl").trim() !== "" ||
    readString(s, "ctaText").trim() !== ""
  );
}

function readKicker(slide: Record<string, unknown>, textConfig?: Record<string, unknown>): string {
  const fromSlide =
    readString(slide, "kicker").trim() ||
    readString(slide, "badge").trim() ||
    readString(slide, "eyebrow").trim();
  if (fromSlide !== "") return fromSlide;
  return readTextConfigString(textConfig, "heroDefaultKicker").trim();
}

export function HeroSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  featuredPromo?: FeaturedPromo | null;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  heroStyle?: Record<string, unknown>;
  onHeroCta?: (ev: HeroCtaPayload) => void;
}): ReactElement | null {
  const { config, textConfig, featuredPromo, heroStyle, onHeroCta } = props;
  const promoSubtitle = useMemo(
    () => (featuredPromo ? formatFeaturedPromoLine(featuredPromo) : ""),
    [featuredPromo],
  );
  const { theme } = useTheme();
  const slidesRaw = useMemo(() => readSlides(config), [config]);

  const effectiveSlides = useMemo(() => {
    if (slidesRaw.length) return slidesRaw;
    const b = theme.banner;
    const t = String(b?.title ?? "").trim();
    const st = promoSubtitle || String(b?.subtitle ?? "").trim();
    if (b?.enabled && (t !== "" || st !== "")) {
      const logo = typeof theme.logoUrl === "string" ? theme.logoUrl : "";
      return [
        {
          title: b.title ?? "",
          subtitle: st,
          ctaText: "",
          imageUrl: logo,
        } as Record<string, unknown>,
      ];
    }
    return [];
  }, [slidesRaw, theme.banner, theme.logoUrl, promoSubtitle]);

  const hasMeaningfulSlide = useMemo(
    () => effectiveSlides.some(slideHasContent),
    [effectiveSlides],
  );

  const hs = heroStyle ?? {};
  const ctaPosRaw = typeof hs.ctaPosition === "string" ? hs.ctaPosition : "";
  const ctaPosition: "below" | "overlay" | "hidden" =
    ctaPosRaw === "overlay" || ctaPosRaw === "hidden" ? (ctaPosRaw as "overlay" | "hidden") : "overlay";

  const defaultTitle = readTextConfigString(textConfig, "heroDefaultTitle").trim();
  const defaultSubtitle = readTextConfigString(textConfig, "heroDefaultSubtitle").trim();
  const defaultCta = readTextConfigString(textConfig, "heroDefaultCta").trim();
  const defaultKicker = readTextConfigString(textConfig, "heroDefaultKicker").trim();

  const showcaseSettings = useMemo(() => parseHeroShowcaseSettings(hs), [hs]);

  const heroPreset =
    readString(config, "heroPreset").trim() || readString(hs, "heroPreset").trim();
  const heightModeRaw = readString(hs, "heightMode").trim().toLowerCase();
  const heightMode: "tall" | "compact" | "" =
    heightModeRaw === "tall"
      ? "tall"
      : heightModeRaw === "compact" || heightModeRaw === ""
        ? "compact"
        : "";

  const showcaseSlides = useMemo((): ShowcaseMarqueeSlide[] => {
    return effectiveSlides.filter(slideHasContent).map((slide, idx) => {
      const title =
        readString(slide, "title").trim() !== "" ? readString(slide, "title") : defaultTitle;
      const subtitle =
        promoSubtitle && idx === 0
          ? promoSubtitle
          : readString(slide, "subtitle").trim() !== ""
            ? readString(slide, "subtitle")
            : defaultSubtitle;
      const ctaText =
        readString(slide, "ctaText").trim() !== "" ? readString(slide, "ctaText") : defaultCta;
      const kicker = readKicker(slide, textConfig) || (idx === 0 ? defaultKicker : "");
      return {
        raw: slide,
        title,
        subtitle,
        kicker,
        ctaText,
        imageUrl: readString(slide, "imageUrl"),
        overlayGradient: readString(slide, "overlayGradient").trim(),
      };
    });
  }, [
    effectiveSlides,
    defaultTitle,
    defaultSubtitle,
    defaultCta,
    defaultKicker,
    promoSubtitle,
    textConfig,
  ]);

  const activateCta = useCallback(
    (slide: Record<string, unknown>) => {
      const text = readString(slide, "ctaText").trim();
      if (!text) return;
      const url = readString(slide, "ctaUrl").trim();
      let kind = readString(slide, "ctaKind").trim().toLowerCase();
      const target = readString(slide, "ctaTarget").trim() || url;
      if (!kind) {
        if (url) kind = "url";
        else if (/^\d+$/.test(target)) kind = "openproduct";
        else kind = "none";
      }
      if (kind === "none" || kind === "") return;
      if (kind === "url") {
        const href = url || target;
        if (!href) return;
        try {
          const u = new URL(href, window.location.origin);
          if (u.protocol === "http:" || u.protocol === "https:") {
            window.open(u.toString(), "_blank", "noopener,noreferrer");
          }
        } catch {
          /* ignore */
        }
        return;
      }
      const map: Record<string, HeroCtaPayload["kind"]> = {
        scrolltosection: "scrollToSection",
        opencategory: "openCategory",
        openproduct: "openProduct",
      };
      const nk = kind.replace(/-/g, "").toLowerCase();
      const mapped = map[nk];
      if (!mapped || !target) return;
      onHeroCta?.({ kind: mapped, target });
    },
    [onHeroCta],
  );

  if (!hasMeaningfulSlide || showcaseSlides.length === 0) return null;

  return (
    <ShowcaseMarqueeHero
      slides={showcaseSlides}
      showcase={showcaseSettings}
      heightMode={heightMode}
      heroPreset={heroPreset}
      ctaPosition={ctaPosition}
      onActivateCta={activateCta}
    />
  );
}
