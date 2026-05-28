import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type TouchEvent,
} from "react";
import {
  HERO_SHOWCASE_SPEED_SECONDS,
  type HeroShowcaseSettings,
} from "../../../storefront/heroShowcaseSettings";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./showcaseMarqueeHero.css";

export type ShowcaseMarqueeSlide = {
  raw: Record<string, unknown>;
  title: string;
  subtitle: string;
  kicker: string;
  ctaText: string;
  imageUrl: string;
  overlayGradient: string;
};

const RESUME_AUTO_MS = 2600;
const SWIPE_THRESHOLD_PX = 36;

function ShowcaseCard(props: {
  slide: ShowcaseMarqueeSlide;
  ctaPosition: "below" | "overlay" | "hidden";
  staticImage: boolean;
  eagerImage?: boolean;
  onActivateCta: (slide: Record<string, unknown>) => void;
}): ReactElement {
  const { slide, ctaPosition, staticImage, eagerImage, onActivateCta } = props;
  const imgSrc = slide.imageUrl
    ? buildCloudinaryResponsiveUrl(slide.imageUrl, "preview")
    : "";
  const showCta = Boolean(slide.ctaText?.trim()) && ctaPosition !== "hidden";

  const cardStyle = slide.overlayGradient
    ? ({
        ["--sf-showcase-card-overlay" as string]: slide.overlayGradient,
      } as CSSProperties)
    : undefined;

  const onCardClick = () => {
    if (showCta) onActivateCta(slide.raw);
  };

  return (
    <button
      type="button"
      className={[
        "sf-showcase__card",
        staticImage ? "sf-showcase__card--static" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={cardStyle}
      onClick={onCardClick}
      aria-label={[slide.title, slide.subtitle].filter(Boolean).join(". ") || "Баннер"}
    >
      <div className="sf-showcase__card-media">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="sf-showcase__card-img"
            loading={eagerImage ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eagerImage ? "high" : "low"}
          />
        ) : (
          <div
            className="sf-showcase__card-img"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, var(--sf-showcase-accent) 35%, #1a1a1a), #0a0a0a)`,
            }}
          />
        )}
        <div
          className={[
            "sf-showcase__card-shade",
            slide.overlayGradient ? "sf-showcase__card-shade--custom" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        <div className="sf-showcase__card-ambient" aria-hidden />
        <div className="sf-showcase__card-edge" aria-hidden />
      </div>
      <div className="sf-showcase__card-body">
        {slide.kicker ? <span className="sf-showcase__kicker">{slide.kicker}</span> : null}
        {slide.title ? <h2 className="sf-showcase__title">{slide.title}</h2> : null}
        {slide.subtitle ? <p className="sf-showcase__subtitle">{slide.subtitle}</p> : null}
        {showCta && ctaPosition === "overlay" ? (
          <span className="sf-showcase__cta" role="presentation">
            {slide.ctaText}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function ShowcaseMarqueeHero(props: {
  slides: ShowcaseMarqueeSlide[];
  showcase: HeroShowcaseSettings;
  heightMode?: "tall" | "compact" | "";
  heroPreset?: string;
  ctaPosition: "below" | "overlay" | "hidden";
  onActivateCta: (slide: Record<string, unknown>) => void;
}): ReactElement {
  const { slides, showcase, heightMode, heroPreset, ctaPosition, onActivateCta } = props;
  const count = slides.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);

  const [paused, setPaused] = useState(false);
  const [manualScroll, setManualScroll] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const canAnimate =
    count > 1 && showcase.autoMove && !reducedMotion && !manualScroll;

  const durationSec = HERO_SHOWCASE_SPEED_SECONDS[showcase.speed];

  const trackStyle = useMemo(
    () =>
      ({
        ["--sf-showcase-dur" as string]: `${durationSec}s`,
      }) as CSSProperties,
    [durationSec],
  );

  const loopSlides = useMemo(() => {
    if (count <= 1) return slides;
    if (showcase.autoMove && !reducedMotion) return [...slides, ...slides];
    return slides;
  }, [slides, count, showcase.autoMove, reducedMotion]);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current != null) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (!showcase.autoMove) return;
    clearResumeTimer();
    resumeTimer.current = window.setTimeout(() => {
      setPaused(false);
      setManualScroll(false);
      resumeTimer.current = null;
    }, RESUME_AUTO_MS);
  }, [showcase.autoMove, clearResumeTimer]);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);

  const pauseForInteraction = useCallback(() => {
    if (!showcase.pauseOnTouch) return;
    setPaused(true);
    if (count > 1) setManualScroll(true);
    clearResumeTimer();
  }, [showcase.pauseOnTouch, count, clearResumeTimer]);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      pauseForInteraction();
      touchStartX.current = e.touches[0]?.clientX ?? null;
    },
    [pauseForInteraction],
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      const vp = viewportRef.current;
      if (start != null && vp && manualScroll) {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - start;
        if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
          vp.scrollLeft += -dx;
        }
      }
      scheduleResume();
    },
    [manualScroll, scheduleResume],
  );

  const onPointerEnter = useCallback(() => {
    if (!showcase.pauseOnHover) return;
    setHoverPaused(true);
  }, [showcase.pauseOnHover]);

  const onPointerLeave = useCallback(() => {
    setHoverPaused(false);
    if (!paused) return;
    scheduleResume();
  }, [showcase.pauseOnHover, paused, scheduleResume]);

  const animationPaused = paused || hoverPaused || !canAnimate;

  const trackClass = [
    "sf-showcase__track",
    canAnimate ? "sf-showcase__track--animate" : "",
    showcase.direction === "right" ? "sf-showcase__track--reverse" : "",
    showcase.infiniteLoop ? "" : "sf-showcase__track--once",
    animationPaused ? "sf-showcase__track--paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const scrollable = count > 1 && (!canAnimate || manualScroll);
  const viewportClass = [
    "sf-showcase__viewport",
    scrollable ? "sf-showcase__viewport--scroll" : "",
    count <= 1 ? "sf-showcase__viewport--single" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className="sf-section sf-section--hero sf-section--padded sf-showcase-section"
      aria-roledescription="marquee"
      aria-label="Витрина баннеров"
    >
      <div
        className="sf-showcase"
        data-sf-hero-preset={heroPreset || undefined}
        data-sf-hero-height={heightMode || undefined}
      >
        <div
          ref={viewportRef}
          className={viewportClass}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        >
          <div className={trackClass} style={trackStyle}>
            {loopSlides.map((slide, i) => (
              <ShowcaseCard
                key={`${i}-${slide.imageUrl}-${slide.title}`}
                slide={slide}
                ctaPosition={ctaPosition}
                staticImage={!canAnimate || reducedMotion}
                eagerImage={i < Math.min(count, 2)}
                onActivateCta={onActivateCta}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
