import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";

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
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  heroStyle?: Record<string, unknown>;
}): ReactElement {
  const { theme } = useTheme();
  const slidesRaw = useMemo(() => readSlides(props.config), [props.config]);

  const effectiveSlides = useMemo(() => {
    if (slidesRaw.length) return slidesRaw;
    const b = theme.banner;
    const t = String(b?.title ?? "").trim();
    const st = String(b?.subtitle ?? "").trim();
    if (b?.enabled && (t !== "" || st !== "")) {
      const logo = typeof theme.logoUrl === "string" ? theme.logoUrl : "";
      return [
        {
          title: b.title ?? "",
          subtitle: b.subtitle ?? "",
          ctaText: "",
          imageUrl: logo,
        } as Record<string, unknown>,
      ];
    }
    return [{} as Record<string, unknown>];
  }, [slidesRaw, theme.banner, theme.logoUrl]);

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

  const kit = props.kit ?? "default";
  const hs = props.heroStyle ?? {};
  const layoutRaw = typeof hs.layout === "string" ? hs.layout : "";
  const layout: "centered" | "split" | "banner" | "editorial" | "" =
    layoutRaw === "split" || layoutRaw === "banner" || layoutRaw === "editorial" || layoutRaw === "centered"
      ? (layoutRaw as "split" | "banner" | "editorial" | "centered")
      : "";
  const heroClass = layout ? `sf-hero sf-hero--${layout}` : "sf-hero";
  const ctaPosRaw = typeof hs.ctaPosition === "string" ? hs.ctaPosition : "";
  const ctaPosition: "below" | "overlay" | "hidden" =
    ctaPosRaw === "overlay" || ctaPosRaw === "hidden" ? (ctaPosRaw as "overlay" | "hidden") : "below";

  const slide = effectiveSlides[Math.min(slideIndex, effectiveSlides.length - 1)] ?? {};

  const defaultTitle =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle")
      : "Добро пожаловать";
  const defaultSubtitle =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultSubtitle").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultSubtitle")
      : "";
  const defaultCta =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultCta").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultCta")
      : "";

  const title =
    readString(slide, "title").trim() !== "" ? readString(slide, "title") : defaultTitle;
  const subtitle =
    readString(slide, "subtitle").trim() !== "" ? readString(slide, "subtitle") : defaultSubtitle;
  const ctaText =
    readString(slide, "ctaText").trim() !== "" ? readString(slide, "ctaText") : defaultCta;
  const imageUrlRaw = readString(slide, "imageUrl");
  const imageUrl = buildCloudinaryResponsiveUrl(imageUrlRaw, "preview");

  if (kit === "fashion") {
    return (
      <section className="sf-section sf-section--hero sf-section--padded">
        <div className={`${heroClass} sf-hero--fashion`}>
          <div className="sf-hero__copy">
            <div className="sf-hero__kicker">EDITORIAL</div>
            <div className="sf-hero__title">{title}</div>
            {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
            {ctaText && ctaPosition !== "hidden" ? (
              <div className="sf-hero__cta-wrap">
                <button type="button" className="sf-hero__cta">
                  {ctaText}
                </button>
              </div>
            ) : null}
            <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
          </div>
          <div
            className="sf-hero__media"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (kit === "luxury") {
    return (
      <section className="sf-section sf-section--hero sf-section--padded">
        <div className={`${heroClass} sf-hero--luxury`}>
          {imageUrl ? (
            <div
              className="sf-hero__media"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <img src={imageUrl} alt="" loading="lazy" />
              <div className="sf-hero__overlay">
                <div className="sf-hero__title">{title}</div>
                {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
                {ctaText && ctaPosition !== "hidden" ? (
                  <div className="sf-hero__cta-wrap">
                    <button type="button" className="sf-hero__cta">
                      {ctaText}
                    </button>
                  </div>
                ) : null}
                <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
              </div>
            </div>
          ) : (
            <div className="sf-hero__overlay sf-hero__overlay--noimg">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition !== "hidden" ? (
                <div className="sf-hero__cta-wrap">
                  <button type="button" className="sf-hero__cta">
                    {ctaText}
                  </button>
                </div>
              ) : null}
              <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sf-section sf-section--hero sf-section--padded">
      <div className={`${heroClass} sf-hero--centered`}>
        <div
          className="sf-hero__media"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          <div className="sf-hero__overlay">
            <div className="sf-hero__body">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition === "overlay" ? (
                <button type="button" className="sf-hero__cta">
                  {ctaText}
                </button>
              ) : null}
              <HeroDots count={effectiveSlides.length} index={slideIndex} onPick={setSlideIndex} />
            </div>
          </div>
        </div>
        {ctaText && ctaPosition === "below" ? (
          <div className="sf-hero__below">
            <button type="button" className="sf-hero__cta">
              {ctaText}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
