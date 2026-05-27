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
import type { Product } from "../../../types";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./CatalogFooterSlider.css";

const AUTOPLAY_MS = 5500;
const PROGRESS_SEGMENTS_MAX = 8;
const SWIPE_THRESHOLD_PX = 48;
const PARALLAX_FACTOR = 0.12;
const PARALLAX_MAX_PX = 14;

type ResolvedSlide = {
  imageUrl: string;
  caption: string;
  product?: Product;
  externalHref: string;
  kicker: string;
  subtitle: string;
};

function productPrimaryImage(p: Product): string {
  const a = typeof p.image === "string" ? p.image.trim() : "";
  if (a !== "") return a;
  const first = p.images?.[0];
  return typeof first === "string" ? first.trim() : "";
}

function readCatalogFooter(styleConfig: Record<string, unknown> | null | undefined): {
  enabled: boolean;
  title: string;
} | null {
  if (!styleConfig || typeof styleConfig !== "object") return null;
  const raw = styleConfig.catalogFooter;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    title: typeof o.title === "string" ? o.title : "Букеты",
  };
}

function formatProductKicker(p: Product | undefined): string {
  if (!p) return "";
  if (p.isSale) return "Скидка";
  if (p.isPopular) return "Хит";
  if (p.isNew) return "Новинка";
  return "";
}

function formatProductSubtitle(p: Product | undefined): string {
  if (!p || !Number.isFinite(p.price)) return "";
  const price = Math.round(p.price);
  const discount = p.discountPercent;
  if (typeof discount === "number" && discount > 0 && discount < 100) {
    const sale = Math.round(price * (1 - discount / 100));
    return `${sale.toLocaleString("ru-RU")} сом`;
  }
  return `${price.toLocaleString("ru-RU")} сом`;
}

function formatProductSubtitleWithStrike(p: Product | undefined): ReactElement | string {
  const line = formatProductSubtitle(p);
  if (!p || line === "") return "";
  const discount = p.discountPercent;
  if (typeof discount === "number" && discount > 0 && discount < 100) {
    const old = Math.round(p.price).toLocaleString("ru-RU");
    return (
      <>
        <s>{old} сом</s>
        {line}
      </>
    );
  }
  return line;
}

export function buildFooterSliderSlidesFromProducts(products: Product[]): ResolvedSlide[] {
  const seen = new Set<number>();
  const out: ResolvedSlide[] = [];
  for (const p of products) {
    const id = p.id;
    if (typeof id === "number" && seen.has(id)) continue;
    const imageUrl = productPrimaryImage(p);
    if (imageUrl === "") continue;
    if (typeof id === "number") seen.add(id);
    out.push({
      imageUrl,
      caption: (p.name ?? "").trim(),
      product: p,
      externalHref: "",
      kicker: formatProductKicker(p),
      subtitle: formatProductSubtitle(p),
    });
  }
  return out;
}

export function catalogFooterCanShow(
  enabled: boolean,
  products: Product[],
): boolean {
  if (!enabled) return false;
  return buildFooterSliderSlidesFromProducts(products).length > 0;
}

function displayTitle(slide: ResolvedSlide): string {
  const fromProduct = slide.product?.name?.trim() ?? "";
  if (fromProduct !== "") return fromProduct;
  return slide.caption.trim();
}

function slideIsActionable(slide: ResolvedSlide, onOpenProduct?: (p: Product) => void): boolean {
  if (slide.product != null && onOpenProduct) return true;
  const href = slide.externalHref;
  return href !== "" && /^https?:\/\//i.test(href);
}

function PromoProgress(props: {
  count: number;
  index: number;
  animKey: number;
  paused: boolean;
  onPick: (i: number) => void;
}): ReactElement | null {
  if (props.count <= 1) return null;

  const fillClass = [
    "sf-cine-promo__progress-fill",
    props.paused ? "sf-cine-promo__progress-fill--paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fillStyle = {
    ["--sf-cine-promo-autoplay-ms" as string]: `${AUTOPLAY_MS}ms`,
  } as CSSProperties;

  if (props.count > PROGRESS_SEGMENTS_MAX) {
    return (
      <div className="sf-cine-promo__progress sf-cine-promo__progress--single" role="progressbar">
        <div className="sf-cine-promo__progress-seg">
          <span className={fillClass} style={fillStyle} key={`fill-${props.animKey}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="sf-cine-promo__progress" role="tablist" aria-label="Слайды акций">
      {Array.from({ length: props.count }, (_, i) => {
        const active = i === props.index;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Слайд ${i + 1}`}
            className="sf-cine-promo__progress-seg"
            onClick={() => props.onPick(i)}
          >
            <span
              className={
                active
                  ? fillClass
                  : "sf-cine-promo__progress-fill sf-cine-promo__progress-fill--done"
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

export function CatalogFooterSlider(props: {
  storefrontStyleConfig?: Record<string, unknown> | null;
  catalogProducts: Product[];
  onOpenProduct?: (product: Product) => void;
}): ReactElement | null {
  const cfg = readCatalogFooter(props.storefrontStyleConfig ?? undefined);
  const resolved = useMemo(() => {
    if (!cfg?.enabled) return [];
    return buildFooterSliderSlidesFromProducts(props.catalogProducts);
  }, [cfg?.enabled, props.catalogProducts]);

  const count = resolved.length;
  const [slideIndex, setSlideIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parallaxX, setParallaxX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
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
    },
    [count],
  );

  useEffect(() => {
    setSlideIndex(0);
    setLeavingIndex(null);
    setProgressKey((k) => k + 1);
  }, [count]);

  useEffect(
    () => () => {
      if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (count <= 1 || paused) return undefined;
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
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

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

  const openSlide = useCallback(
    (slide: ResolvedSlide) => {
      if (slide.product != null && props.onOpenProduct) {
        props.onOpenProduct(slide.product);
        return;
      }
      const href = slide.externalHref;
      if (href !== "" && /^https?:\/\//i.test(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [props.onOpenProduct],
  );

  if (!cfg?.enabled || resolved.length === 0) return null;

  const sectionTitle = cfg.title.trim() !== "" ? cfg.title : "Букеты";
  const safeIndex = Math.min(slideIndex, Math.max(resolved.length - 1, 0));
  const current = resolved[safeIndex];
  const currentTitle = current ? displayTitle(current) : "";
  const actionable = current ? slideIsActionable(current, props.onOpenProduct) : false;

  const parallaxStyle = {
    transform: `scale(1.05) translate3d(${parallaxX}px, 0, 0)`,
  } as CSSProperties;

  return (
    <section
      className="sf-cine-promo-section"
      aria-label={sectionTitle}
      aria-roledescription="carousel"
    >
      <header className="sf-cine-promo__head">
        <h2 className="sf-cine-promo__section-title">{sectionTitle}</h2>
        {count > 1 ? (
          <span className="sf-cine-promo__head-meta">
            {safeIndex + 1} / {count}
          </span>
        ) : null}
      </header>

      <div className="sf-cine-promo__wrap">
        <div className="sf-cine-promo">
          <div
            className="sf-cine-promo__viewport"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
          >
            <div className="sf-cine-promo__stack" aria-hidden>
              {resolved.map((slide, i) => {
                const isActive = i === safeIndex;
                const isLeaving = i === leavingIndex;
                const imgSrc = buildCloudinaryResponsiveUrl(slide.imageUrl, "preview");
                const slideClass = [
                  "sf-cine-promo__slide",
                  isActive ? "is-active" : "",
                  isLeaving ? "is-leaving" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={
                      slide.product?.id != null
                        ? `product-${slide.product.id}`
                        : `${i}-${slide.imageUrl.slice(0, 24)}`
                    }
                    className={slideClass}
                  >
                    <button
                      type="button"
                      className="sf-cine-promo__hit"
                      onClick={() => isActive && openSlide(slide)}
                      tabIndex={isActive ? 0 : -1}
                      aria-hidden={!isActive}
                    >
                      <div className="sf-cine-promo__media">
                        <img
                          src={imgSrc}
                          alt=""
                          className={[
                            "sf-cine-promo__img",
                            parallaxX !== 0 && isActive ? "sf-cine-promo__img--parallax" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={isActive && parallaxX !== 0 ? parallaxStyle : undefined}
                          loading={i === 0 ? "eager" : "lazy"}
                          decoding="async"
                        />
                        <div className="sf-cine-promo__shade" />
                        <div className="sf-cine-promo__ambient" />
                        <div className="sf-cine-promo__edge" />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {count > 1 ? (
              <span className="sf-cine-promo__counter" aria-hidden>
                {safeIndex + 1}/{count}
              </span>
            ) : null}

            <PromoProgress
              count={count}
              index={safeIndex}
              animKey={progressKey}
              paused={paused}
              onPick={onPickProgress}
            />

            {current ? (
              <div className="sf-cine-promo__content" aria-live="polite">
                <div
                  className="sf-cine-promo__content-inner"
                  key={`promo-copy-${safeIndex}-${progressKey}`}
                >
                  {current.kicker ? (
                    <span className="sf-cine-promo__kicker">{current.kicker}</span>
                  ) : null}
                  {currentTitle ? (
                    <h3 className="sf-cine-promo__title">{currentTitle}</h3>
                  ) : null}
                  {current.subtitle !== "" ? (
                    <p className="sf-cine-promo__subtitle">
                      {formatProductSubtitleWithStrike(current.product)}
                    </p>
                  ) : null}
                  {actionable ? (
                    <div className="sf-cine-promo__cta-row">
                      <button
                        type="button"
                        className="sf-cine-promo__cta"
                        onClick={() => openSlide(current)}
                      >
                        Смотреть
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
