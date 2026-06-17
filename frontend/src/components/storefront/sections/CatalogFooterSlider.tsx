import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { Product } from "../../../types";
import {
  parseCatalogFooterRailSettings,
  type CatalogFooterRailSpeed,
} from "../../../storefront/catalogFooterRailSettings";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import { getDiscountPercent, getEffectivePrice, getPrimaryImage } from "../../../utils/product";
import "./CatalogFooterSlider.css";

const TICK_MS = 32;

const RAIL_SCROLL_PX_PER_SEC: Record<CatalogFooterRailSpeed, number> = {
  slow: 28,
  medium: 44,
  fast: 68,
};

export type ResolvedSlide = {
  imageUrl: string;
  caption: string;
  product?: Product;
  externalHref: string;
  kicker: string;
  subtitle: string;
};

function productPrimaryImage(p: Product): string {
  const url = getPrimaryImage(p);
  return typeof url === "string" ? url.trim() : "";
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
    title: typeof o.title === "string" ? o.title : "",
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
  return `${getEffectivePrice(p).toLocaleString("ru-RU")} сом`;
}

function formatProductPriceLine(p: Product | undefined): ReactElement | string {
  if (!p || !Number.isFinite(p.price)) return "";
  const sale = formatProductSubtitle(p);
  const discount = getDiscountPercent(p);
  if (discount > 0) {
    const old = Math.round(p.price).toLocaleString("ru-RU");
    return (
      <>
        <s>{old} сом</s> {sale}
      </>
    );
  }
  return sale;
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

function supportsFineHoverPause(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ?? false;
}

function measureRailLoopWidth(track: HTMLDivElement, slideCount: number): number {
  if (slideCount <= 0) return 0;
  const children = track.children;
  if (children.length < slideCount) return 0;
  const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "10") || 10;
  let width = 0;
  for (let i = 0; i < slideCount; i += 1) {
    const el = children[i] as HTMLElement | undefined;
    if (!el) return 0;
    width += el.getBoundingClientRect().width;
    if (i > 0) width += gap;
  }
  return width;
}

function ProductRailCard(props: {
  slide: ResolvedSlide;
  eagerImage?: boolean;
  onOpen: (slide: ResolvedSlide) => void;
}): ReactElement {
  const { slide, eagerImage, onOpen } = props;
  const title = displayTitle(slide);
  const imgSrc = buildCloudinaryResponsiveUrl(slide.imageUrl, "thumbnail");

  return (
    <button
      type="button"
      className="sf-product-rail__card"
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
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);

  const canAnimate = count > 1 && rail.autoMove;

  const loopSlides = useMemo(() => {
    if (count <= 1) return resolved;
    if (rail.autoMove && rail.infiniteLoop) {
      return [...resolved, ...resolved];
    }
    return resolved;
  }, [resolved, count, rail.autoMove, rail.infiniteLoop]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !canAnimate) {
      loopWidthRef.current = 0;
      return;
    }
    const measure = () => {
      const loopW = measureRailLoopWidth(track, count);
      if (loopW > 0 && loopWidthRef.current !== loopW) {
        loopWidthRef.current = loopW;
        const movingRight = rail.direction === "right";
        offsetRef.current = movingRight ? -loopW : 0;
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
        setLayoutTick((n) => n + 1);
      }
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(track);
    for (const child of track.children) {
      ro?.observe(child);
    }
    const imgs = track.querySelectorAll("img");
    for (const img of imgs) {
      if (!(img instanceof HTMLImageElement)) continue;
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    }
    return () => ro?.disconnect();
  }, [canAnimate, count, rail.direction, loopSlides.length]);

  useEffect(() => {
    if (!canAnimate) {
      const track = trackRef.current;
      if (track) track.style.transform = "";
      offsetRef.current = 0;
      loopWidthRef.current = 0;
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    const movingRight = rail.direction === "right";
    const speed = RAIL_SCROLL_PX_PER_SEC[rail.speed];
    const paused = hoverPaused && supportsFineHoverPause();

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const el = trackRef.current;
      if (!el || paused) return;

      let loopW = loopWidthRef.current;
      if (loopW <= 0) {
        loopW = measureRailLoopWidth(el, count);
        if (loopW <= 0) return;
        loopWidthRef.current = loopW;
        offsetRef.current = movingRight ? -loopW : 0;
      }

      const step = (speed * TICK_MS) / 1000;
      if (movingRight) {
        offsetRef.current += step;
        if (offsetRef.current >= 0) offsetRef.current -= loopW;
      } else {
        offsetRef.current -= step;
        if (offsetRef.current <= -loopW) offsetRef.current += loopW;
      }
      el.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    };

    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [canAnimate, count, hoverPaused, rail.direction, rail.speed, layoutTick]);

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

  const sectionTitle = cfg.title.trim() !== "" ? cfg.title : "Подборка";

  const trackClass = [
    "sf-product-rail__track",
    "sf-product-rail__track--scroll",
    canAnimate ? "sf-product-rail__track--marquee" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const viewportClass = [
    "sf-product-rail__viewport",
    canAnimate ? "sf-product-rail__viewport--marquee" : "",
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
            className={viewportClass}
            onMouseEnter={() => {
              if (canAnimate && supportsFineHoverPause()) setHoverPaused(true);
            }}
            onMouseLeave={() => {
              if (supportsFineHoverPause()) setHoverPaused(false);
            }}
          >
            <div ref={trackRef} className={trackClass}>
              {loopSlides.map((slide, i) => (
                <ProductRailCard
                  key={
                    slide.product?.id != null
                      ? `p-${slide.product.id}-${i}`
                      : `${i}-${slide.imageUrl.slice(0, 20)}`
                  }
                  slide={slide}
                  eagerImage
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
