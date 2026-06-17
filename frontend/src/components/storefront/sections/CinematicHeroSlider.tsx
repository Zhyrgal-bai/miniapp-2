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
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import { AmbientImageGlow } from "../product/AmbientImageGlow";
import "./cinematicHeroSlider.css";

const PROGRESS_SEGMENTS_MAX = 8;
const SWIPE_THRESHOLD_PX = 48;
const PARALLAX_FACTOR = 0.12;
const PARALLAX_MAX_PX = 14;

export type CinematicHeroSlide = {
  raw: Record<string, unknown>;
  title: string;
  subtitle: string;
  kicker: string;
  ctaText: string;
  imageUrl: string;
  overlayGradient: string;
};

function HeroProgress(props: {
  count: number;
  index: number;
  animKey: number;
  paused: boolean;
  autoplayMs: number;
  onPick: (i: number) => void;
}): ReactElement | null {
  if (props.count <= 1) return null;

  const fillClass = [
    "sf-cine-hero__progress-fill",
    props.paused ? "sf-cine-hero__progress-fill--paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fillStyle = {
    ["--sf-cine-autoplay-ms" as string]: `${props.autoplayMs}ms`,
  } as CSSProperties;

  if (props.count > PROGRESS_SEGMENTS_MAX) {
    return (
      <div className="sf-cine-hero__progress sf-cine-hero__progress--single" role="progressbar">
        <div className="sf-cine-hero__progress-seg">
          <span className={fillClass} style={fillStyle} key={`fill-${props.animKey}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="sf-cine-hero__progress" role="tablist" aria-label="Слайды">
      {Array.from({ length: props.count }, (_, i) => {
        const active = i === props.index;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Слайд ${i + 1}`}
            className="sf-cine-hero__progress-seg"
            onClick={() => props.onPick(i)}
          >
            <span
              className={
                active
                  ? fillClass
                  : "sf-cine-hero__progress-fill sf-cine-hero__progress-fill--done"
              }
              style={active ? fillStyle : undefined}
              key={active ? `fill-${props.index}-${props.animKey}` : `done-${i}`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function CinematicHeroSlider(props: {
  slides: CinematicHeroSlide[];
  autoplayMs: number;
  heightMode?: "tall" | "compact" | "";
  heroPreset?: string;
  storeSlug?: string;
  ctaPosition: "below" | "overlay" | "hidden";
  onActivateCta: (slide: Record<string, unknown>) => void;
}): ReactElement {
  const { slides, autoplayMs, heightMode, heroPreset, storeSlug, ctaPosition, onActivateCta } = props;
  const count = slides.length;

  const [slideIndex, setSlideIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parallaxX, setParallaxX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const goTo = useCallback((next: number) => {
    if (count <= 0) return;
    setSlideIndex((current) => {
      const clamped = ((next % count) + count) % count;
      if (clamped === current) return current;
      setLeavingIndex(current);
      setProgressKey((k) => k + 1);
      setParallaxX(0);
      if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => {
        setLeavingIndex(null);
        leaveTimer.current = null;
      }, 780);
      return clamped;
    });
  }, [count]);

  useEffect(() => {
    setSlideIndex(0);
    setLeavingIndex(null);
    setProgressKey((k) => k + 1);
  }, [count, slides]);

  useEffect(
    () => () => {
      if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (autoplayMs <= 0 || count <= 1 || paused) return undefined;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSlideIndex((i) => {
        const next = i + 1 >= count ? 0 : i + 1;
        setLeavingIndex(i);
        setProgressKey((k) => k + 1);
        if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(() => {
          setLeavingIndex(null);
          leaveTimer.current = null;
        }, 780);
        return next;
      });
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, count, paused]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    setPaused(true);
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const start = touchStartX.current;
    if (start == null) return;
    const x = e.touches[0]?.clientX ?? start;
    const dx = x - start;
    const clamped = Math.max(-PARALLAX_MAX_PX, Math.min(PARALLAX_MAX_PX, dx * PARALLAX_FACTOR));
    setParallaxX(clamped);
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      setParallaxX(0);
      window.setTimeout(() => setPaused(false), 2400);
      if (start == null || count <= 1) return;
      const dx = (e.changedTouches[0]?.clientX ?? 0) - start;
      if (dx < -SWIPE_THRESHOLD_PX) goTo(slideIndex + 1);
      else if (dx > SWIPE_THRESHOLD_PX) goTo(slideIndex - 1);
    },
    [count, slideIndex, goTo],
  );

  const onPickProgress = useCallback((i: number) => goTo(i), [goTo]);

  const current = slides[Math.min(slideIndex, Math.max(count - 1, 0))];
  const showCta =
    Boolean(current?.ctaText?.trim()) && ctaPosition !== "hidden";

  const rootStyle = useMemo(() => {
    if (!current?.overlayGradient) return undefined;
    return {
      ["--sf-cine-slide-overlay" as string]: current.overlayGradient,
    } as CSSProperties;
  }, [current?.overlayGradient]);

  const parallaxStyle = useMemo(
    () =>
      ({
        transform: `scale(1.04) translate3d(${parallaxX}px, 0, 0)`,
      }) as CSSProperties,
    [parallaxX],
  );

  return (
    <section
      className="sf-section sf-section--hero sf-section--padded sf-cine-hero-section"
      aria-roledescription="carousel"
      aria-label="Главный баннер"
    >
      <div
        className="sf-cine-hero"
        data-sf-hero-preset={heroPreset || undefined}
        data-sf-hero-height={heightMode || undefined}
        data-sf-hero-store={storeSlug || undefined}
        style={rootStyle}
      >
        <div
          className="sf-cine-hero__viewport"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sf-cine-hero__stack" aria-hidden>
            {slides.map((s, i) => {
              const isActive = i === slideIndex;
              const isLeaving = i === leavingIndex;
              const imgSrc = s.imageUrl
                ? buildCloudinaryResponsiveUrl(s.imageUrl, "preview")
                : "";
              const slideClass = [
                "sf-cine-hero__slide",
                isActive ? "is-active" : "",
                isLeaving ? "is-leaving" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div key={`${i}-${s.imageUrl}-${s.title}`} className={slideClass}>
                  <div className="sf-cine-hero__media">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className={[
                          "sf-cine-hero__img",
                          parallaxX !== 0 && isActive ? "sf-cine-hero__img--parallax" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={isActive && parallaxX !== 0 ? parallaxStyle : undefined}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={i === 0 ? "high" : "low"}
                      />
                    ) : (
                      <div
                        className="sf-cine-hero__img"
                        style={{
                          background: `linear-gradient(145deg, color-mix(in srgb, var(--sf-cine-accent) 35%, #1a1a1a), #0a0a0a)`,
                        }}
                      />
                    )}
                    <div
                      className={[
                        "sf-cine-hero__shade",
                        s.overlayGradient ? "sf-cine-hero__shade--custom" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <AmbientImageGlow src={imgSrc} className="sf-ambient-glow--hero" />
                    <div className="sf-cine-hero__edge" />
                  </div>
                </div>
              );
            })}
          </div>

          {count > 1 ? (
            <span className="sf-cine-hero__counter" aria-hidden>
              {slideIndex + 1}/{count}
            </span>
          ) : null}

          <HeroProgress
            count={count}
            index={slideIndex}
            animKey={progressKey}
            paused={paused}
            autoplayMs={autoplayMs > 0 ? autoplayMs : 5500}
            onPick={onPickProgress}
          />

          {current ? (
            <div className="sf-cine-hero__content" aria-live="polite">
              <div className="sf-cine-hero__content-inner" key={`copy-${slideIndex}-${progressKey}`}>
                {current.kicker ? (
                  <span className="sf-cine-hero__kicker">{current.kicker}</span>
                ) : null}
                {current.title ? (
                  <h2 className="sf-cine-hero__title">{current.title}</h2>
                ) : null}
                {current.subtitle ? (
                  <p className="sf-cine-hero__subtitle">{current.subtitle}</p>
                ) : null}
                {showCta ? (
                  <div className="sf-cine-hero__cta-wrap">
                    <button
                      type="button"
                      className="sf-cine-hero__cta"
                      onClick={() => onActivateCta(current.raw)}
                    >
                      {current.ctaText}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
