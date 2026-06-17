import { useCallback, useMemo, type ReactElement } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { useShop } from "../../../context/ShopContext";
import barsHeroBannerUrl from "../../../assets/bars-hero-banner.png";
import {
  formatFeaturedPromoLine,
  type FeaturedPromo,
} from "../../../storefront/featuredPromo";
import {
  CinematicHeroSlider,
  type CinematicHeroSlide,
} from "./CinematicHeroSlider";

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

const BARS_STORE_SLUG = "bars";
const BARS_DEFAULT_BANNER_URL = barsHeroBannerUrl;

function normalizeStoreBrand(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function isBarsStorefrontContext(slug?: string | null, storeName?: string | null): boolean {
  if (String(slug ?? "").trim().toLowerCase() === BARS_STORE_SLUG) return true;
  return normalizeStoreBrand(String(storeName ?? "")) === "BARS";
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
  storefrontSlug?: string | null;
  storeName?: string | null;
  onHeroCta?: (ev: HeroCtaPayload) => void;
}): ReactElement | null {
  const { config, textConfig, featuredPromo, heroStyle, storefrontSlug, storeName, onHeroCta } =
    props;
  const { storefrontSlug: pathSlug } = useShop();
  const isBarsStore = isBarsStorefrontContext(storefrontSlug ?? pathSlug, storeName);
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
      const imageUrl = isBarsStore ? BARS_DEFAULT_BANNER_URL : logo;
      return [
        {
          title: b.title ?? "",
          subtitle: st,
          ctaText: "",
          imageUrl,
        } as Record<string, unknown>,
      ];
    }
    return [];
  }, [slidesRaw, theme.banner, theme.logoUrl, promoSubtitle, isBarsStore]);

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

  const autoplayMs = useMemo(() => {
    if (effectiveSlides.length <= 1) return 0;
    const raw = (hs as { autoplayIntervalMs?: unknown }).autoplayIntervalMs;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 2500) return Math.min(raw, 60_000);
    if ((hs as { autoplay?: unknown }).autoplay === true) return 5500;
    return effectiveSlides.length > 1 ? 5500 : 0;
  }, [effectiveSlides.length, hs]);

  const heroPreset =
    readString(config, "heroPreset").trim() || readString(hs, "heroPreset").trim();
  const heightModeRaw = readString(hs, "heightMode").trim().toLowerCase();
  const heightMode: "tall" | "compact" | "" = isBarsStore
    ? "tall"
    : heightModeRaw === "tall"
      ? "tall"
      : heightModeRaw === "compact" || heightModeRaw === ""
        ? "compact"
        : "";

  const cinematicSlides = useMemo((): CinematicHeroSlide[] => {
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
        imageUrl: isBarsStore ? BARS_DEFAULT_BANNER_URL : readString(slide, "imageUrl"),
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
    isBarsStore,
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

  if (!hasMeaningfulSlide || cinematicSlides.length === 0) return null;

  return (
    <CinematicHeroSlider
      slides={cinematicSlides}
      autoplayMs={autoplayMs}
      heightMode={heightMode}
      heroPreset={heroPreset}
      storeSlug={isBarsStore ? BARS_STORE_SLUG : undefined}
      ctaPosition={ctaPosition}
      onActivateCta={activateCta}
    />
  );
}
