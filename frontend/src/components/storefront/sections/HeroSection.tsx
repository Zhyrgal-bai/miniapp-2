import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import {
  formatFeaturedPromoLine,
  type FeaturedPromo,
} from "../../../storefront/featuredPromo";

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

function HeroDots(props: {
  count: number;
  index: number;
  onPick: (i: number) => void;
}): ReactElement | null {
  if (props.count <= 1) return null;
  return (
    <div className="sf-hero__dots" role="tablist" aria-label="Слайды">
      {Array.from({ length: props.count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === props.index}
          className={i === props.index ? "sf-hero__dot sf-hero__dot--active" : "sf-hero__dot"}
          onClick={() => props.onPick(i)}
        />
      ))}
    </div>
  );
}

export function HeroSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  featuredPromo?: FeaturedPromo | null;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  heroStyle?: Record<string, unknown>;
  onHeroCta?: (ev: HeroCtaPayload) => void;
}): ReactElement | null {
  const {
    config,
    textConfig,
    featuredPromo,
    kit: kitProp = "default",
    heroStyle,
    onHeroCta,
  } = props;
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

  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    setSlideIndex(0);
  }, [effectiveSlides]);

  const touchStartX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || effectiveSlides.length <= 1) return;
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
      touchStartX.current = null;
      const th = 44;
      if (dx < -th) {
        setSlideIndex((i) => Math.min(i + 1, effectiveSlides.length - 1));
      } else if (dx > th) {
        setSlideIndex((i) => Math.max(i - 1, 0));
      }
    },
    [effectiveSlides.length],
  );

  const autoplayMs = useMemo(() => {
    if (effectiveSlides.length <= 1) return 0;
    const hs = heroStyle ?? {};
    const raw = (hs as { autoplayIntervalMs?: unknown }).autoplayIntervalMs;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 2500) return Math.min(raw, 60_000);
    if ((hs as { autoplay?: unknown }).autoplay === true) return 5500;
    return 0;
  }, [effectiveSlides.length, heroStyle]);

  useEffect(() => {
    if (autoplayMs <= 0) return undefined;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSlideIndex((i) => (i + 1 >= effectiveSlides.length ? 0 : i + 1));
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, effectiveSlides.length]);

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
      if (!mapped) return;
      if (!target) return;
      onHeroCta?.({ kind: mapped, target });
    },
    [onHeroCta],
  );

  const kit = kitProp;
  const hs = heroStyle ?? {};
  const layoutRaw = typeof hs.layout === "string" ? hs.layout : "";
  const layout: "centered" | "split" | "banner" | "editorial" | "" =
    layoutRaw === "split" || layoutRaw === "banner" || layoutRaw === "editorial" || layoutRaw === "centered"
      ? (layoutRaw as "split" | "banner" | "editorial" | "centered")
      : "";
  const heroClass = layout ? `sf-hero sf-hero--${layout}` : "sf-hero";
  const ctaPosRaw = typeof hs.ctaPosition === "string" ? hs.ctaPosition : "";
  const ctaPosition: "below" | "overlay" | "hidden" =
    ctaPosRaw === "overlay" || ctaPosRaw === "hidden" ? (ctaPosRaw as "overlay" | "hidden") : "below";

  const slide = effectiveSlides[Math.min(slideIndex, Math.max(effectiveSlides.length - 1, 0))] ?? {};

  const defaultTitle =
    readTextConfigString(textConfig ?? undefined, "heroDefaultTitle").trim() !== ""
      ? readTextConfigString(textConfig ?? undefined, "heroDefaultTitle")
      : "";
  const defaultSubtitle =
    readTextConfigString(textConfig ?? undefined, "heroDefaultSubtitle").trim() !== ""
      ? readTextConfigString(textConfig ?? undefined, "heroDefaultSubtitle")
      : "";
  const defaultCta =
    readTextConfigString(textConfig ?? undefined, "heroDefaultCta").trim() !== ""
      ? readTextConfigString(textConfig ?? undefined, "heroDefaultCta")
      : "";

  const title =
    readString(slide, "title").trim() !== "" ? readString(slide, "title") : defaultTitle;
  const subtitle = promoSubtitle
    ? promoSubtitle
    : readString(slide, "subtitle").trim() !== ""
      ? readString(slide, "subtitle")
      : defaultSubtitle;
  const ctaText =
    readString(slide, "ctaText").trim() !== "" ? readString(slide, "ctaText") : defaultCta;
  const imageUrlRaw = readString(slide, "imageUrl");
  const imageUrl = buildCloudinaryResponsiveUrl(imageUrlRaw, "preview");
  const overlayGrad = readString(slide, "overlayGradient").trim();

  const heroPreset =
    readString(config, "heroPreset").trim() || readString(hs, "heroPreset").trim();
  const heightModeRaw = readString(hs, "heightMode").trim().toLowerCase();

  if (!hasMeaningfulSlide) return null;

  const heroRootStyle = overlayGrad
    ? ({ ["--sf-hero-slide-overlay" as string]: overlayGrad } as CSSProperties)
    : undefined;

  const ctaBtn = (cls: string) =>
    ctaText && ctaPosition !== "hidden" ? (
      <button type="button" className={cls} onClick={() => activateCta(slide)}>
        {ctaText}
      </button>
    ) : null;

  if (kit === "fashion") {
    return (
      <section className="sf-section sf-section--hero sf-section--padded" aria-roledescription="carousel">
        <div
          className={`${heroClass} sf-hero--fashion`}
          data-sf-hero-preset={heroPreset || undefined}
          data-sf-hero-height={
            heightModeRaw === "tall" ? "tall" : heightModeRaw === "compact" ? "compact" : undefined
          }
          style={heroRootStyle}
        >
          <div className="sf-hero__copy" aria-live="polite">
            <div className="sf-hero__kicker">Подборка</div>
            <div className="sf-hero__title">{title}</div>
            {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
            {ctaText && ctaPosition !== "hidden" ? (
              <div className="sf-hero__cta-wrap">
                <button type="button" className="sf-hero__cta" onClick={() => activateCta(slide)}>
                  {ctaText}
                </button>
              </div>
            ) : null}
            <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
          </div>
          <div className="sf-hero__media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (kit === "luxury") {
    return (
      <section className="sf-section sf-section--hero sf-section--padded" aria-roledescription="carousel">
        <div
          className={`${heroClass} sf-hero--luxury`}
          data-sf-hero-preset={heroPreset || undefined}
          data-sf-hero-height={
            heightModeRaw === "tall" ? "tall" : heightModeRaw === "compact" ? "compact" : undefined
          }
          style={heroRootStyle}
        >
          {imageUrl ? (
            <div className="sf-hero__media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <img src={imageUrl} alt="" loading="lazy" />
              <div className="sf-hero__overlay" aria-live="polite">
                <div className="sf-hero__title">{title}</div>
                {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
                {ctaText && ctaPosition !== "hidden" ? (
                  <div className="sf-hero__cta-wrap">{ctaBtn("sf-hero__cta")}</div>
                ) : null}
                <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
              </div>
            </div>
          ) : (
            <div className="sf-hero__overlay sf-hero__overlay--noimg" aria-live="polite">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition !== "hidden" ? (
                <div className="sf-hero__cta-wrap">{ctaBtn("sf-hero__cta")}</div>
              ) : null}
              <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sf-section sf-section--hero sf-section--padded" aria-roledescription="carousel">
      <div
        className={`${heroClass} sf-hero--centered`}
        data-sf-hero-preset={heroPreset || undefined}
        data-sf-hero-height={
          heightModeRaw === "tall" ? "tall" : heightModeRaw === "compact" ? "compact" : undefined
        }
        style={heroRootStyle}
      >
        <div className="sf-hero__media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          <div className="sf-hero__overlay">
            <div className="sf-hero__body" aria-live="polite">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition === "overlay" ? ctaBtn("sf-hero__cta") : null}
              <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
            </div>
          </div>
        </div>
        {ctaText && ctaPosition === "below" ? <div className="sf-hero__below">{ctaBtn("sf-hero__cta")}</div> : null}
      </div>
    </section>
  );
}
