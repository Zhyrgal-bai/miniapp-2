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
import {
  CATALOG_FOOTER_RAIL_SPEED_SECONDS,
  parseCatalogFooterRailSettings,
} from "../../../storefront/catalogFooterRailSettings";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./CatalogFooterSlider.css";

const RESUME_AUTO_MS = 2600;
const SWIPE_THRESHOLD_PX = 36;

export type ResolvedSlide = {
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

function formatProductPriceLine(p: Product | undefined): ReactElement | string {
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

function ProductRailCard(props: {
  slide: ResolvedSlide;
  staticImage: boolean;
  eagerImage?: boolean;
  onOpen: (slide: ResolvedSlide) => void;
}): ReactElement {
  const { slide, staticImage, eagerImage, onOpen } = props;
  const title = displayTitle(slide);
  const imgSrc = buildCloudinaryResponsiveUrl(slide.imageUrl, "thumbnail");

  return (
    <button
      type="button"
      className={["sf-product-rail__card", staticImage ? "sf-product-rail__card--static" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onOpen(slide)}
      aria-label={title || "Товар"}
    >
      <div className="sf-product-rail__media">
        <img
          src={imgSrc}
          alt=""
          className="sf-product-rail__img"
          loading={eagerImage ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eagerImage ? "high" : "low"}
        />
        <div className="sf-product-rail__shade" />
        <div className="sf-product-rail__edge" aria-hidden />
      </div>
      <div className="sf-product-rail__body">
        {slide.kicker ? <span className="sf-product-rail__kicker">{slide.kicker}</span> : null}
        {title ? <h3 className="sf-product-rail__title">{title}</h3> : null}
        {slide.subtitle !== "" ? (
          <p className="sf-product-rail__price">{formatProductPriceLine(slide.product)}</p>
        ) : null}
      </div>
    </button>
  );
}

export function CatalogFooterSlider(props: {
  storefrontStyleConfig?: Record<string, unknown> | null;
  catalogProducts: Product[];
  onOpenProduct?: (product: Product) => void;
}): ReactElement | null {
  const cfg = readCatalogFooter(props.storefrontStyleConfig ?? undefined);
  const rail = useMemo(
    () => parseCatalogFooterRailSettings(props.storefrontStyleConfig ?? undefined),
    [props.storefrontStyleConfig],
  );

  const resolved = useMemo(() => {
    if (!cfg?.enabled) return [];
    return buildFooterSliderSlidesFromProducts(props.catalogProducts);
  }, [cfg?.enabled, props.catalogProducts]);

  const count = resolved.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);

  const [paused, setPaused] = useState(false);
  const [manualScroll, setManualScroll] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const canAnimate = count > 1 && rail.autoMove && !reducedMotion && !manualScroll;

  const durationSec = CATALOG_FOOTER_RAIL_SPEED_SECONDS[rail.speed];
  const trackStyle = useMemo(
    () =>
      ({
        ["--sf-rail-dur" as string]: `${durationSec}s`,
      }) as CSSProperties,
    [durationSec],
  );

  const loopSlides = useMemo(() => {
    if (count <= 1) return resolved;
    if (rail.autoMove && !reducedMotion) return [...resolved, ...resolved];
    return resolved;
  }, [resolved, count, rail.autoMove, reducedMotion]);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current != null) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (!rail.autoMove) return;
    clearResumeTimer();
    resumeTimer.current = window.setTimeout(() => {
      setPaused(false);
      setManualScroll(false);
      resumeTimer.current = null;
    }, RESUME_AUTO_MS);
  }, [rail.autoMove, clearResumeTimer]);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);

  const pauseForInteraction = useCallback(() => {
    if (!rail.pauseOnTouch) return;
    setPaused(true);
    if (count > 1) setManualScroll(true);
    clearResumeTimer();
  }, [rail.pauseOnTouch, count, clearResumeTimer]);

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
        if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) vp.scrollLeft += -dx;
      }
      scheduleResume();
    },
    [manualScroll, scheduleResume],
  );

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
  const scrollable = count > 1 && (!canAnimate || manualScroll);
  const animationPaused = paused || !canAnimate;

  const trackClass = [
    "sf-product-rail__track",
    canAnimate ? "sf-product-rail__track--animate" : "",
    rail.direction === "right" ? "sf-product-rail__track--reverse" : "",
    rail.infiniteLoop ? "" : "sf-product-rail__track--once",
    animationPaused ? "sf-product-rail__track--paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const viewportClass = [
    "sf-product-rail__viewport",
    scrollable ? "sf-product-rail__viewport--scroll" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="sf-product-rail-section" aria-label={sectionTitle}>
      <header className="sf-product-rail__head">
        <h2 className="sf-product-rail__section-title">{sectionTitle}</h2>
      </header>

      <div className="sf-product-rail__wrap">
        <div className="sf-product-rail">
          <div
            ref={viewportRef}
            className={viewportClass}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onPointerEnter={() => rail.pauseOnTouch && setPaused(true)}
            onPointerLeave={() => {
              if (!paused) return;
              scheduleResume();
            }}
          >
            <div className={trackClass} style={trackStyle}>
              {loopSlides.map((slide, i) => (
                <ProductRailCard
                  key={
                    slide.product?.id != null
                      ? `p-${slide.product.id}-${i}`
                      : `${i}-${slide.imageUrl.slice(0, 20)}`
                  }
                  slide={slide}
                  staticImage={!canAnimate || reducedMotion}
                  eagerImage={i < Math.min(count, 3)}
                  onOpen={openSlide}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
