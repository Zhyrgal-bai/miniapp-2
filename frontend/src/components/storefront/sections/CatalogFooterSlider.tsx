import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Product } from "../../../types";
import {
  CATALOG_FOOTER_RAIL_SPEED_SECONDS,
  parseCatalogFooterRailSettings,
} from "../../../storefront/catalogFooterRailSettings";
import { storefrontMotionLevelFromStyleConfig } from "../../../storefront/buildStorefrontLayoutCssVars";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import { getDiscountPercent, getEffectivePrice, getPrimaryImage } from "../../../utils/product";
import "./CatalogFooterSlider.css";

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
  const [hoverPaused, setHoverPaused] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const motionLevel = storefrontMotionLevelFromStyleConfig(
    props.storefrontStyleConfig ?? undefined,
  );
  const motionDisabled = motionLevel === "none";

  const canAnimate =
    count > 1 && rail.autoMove && !reducedMotion && !motionDisabled;

  const loopSlides = useMemo(() => {
    if (count <= 1) return resolved;
    if (rail.autoMove && !reducedMotion && rail.infiniteLoop) {
      return [...resolved, ...resolved];
    }
    return resolved;
  }, [resolved, count, rail.autoMove, rail.infiniteLoop, reducedMotion]);

  const durationSec = CATALOG_FOOTER_RAIL_SPEED_SECONDS[rail.speed];
  const trackStyle = useMemo(
    () =>
      ({
        ["--sf-rail-dur" as string]: `${durationSec}s`,
      }) as CSSProperties,
    [durationSec],
  );

  const animationPaused = hoverPaused && canAnimate && supportsFineHoverPause();

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
    count > 1 ? "sf-product-rail__track--scroll" : "",
    canAnimate ? "sf-product-rail__track--animate sf-product-rail__track--marquee" : "",
    rail.direction === "right" ? "sf-product-rail__track--reverse" : "",
    !rail.infiniteLoop ? "sf-product-rail__track--once" : "",
    animationPaused ? "sf-product-rail__track--paused" : "",
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
            className="sf-product-rail__viewport"
            onMouseEnter={() => {
              if (canAnimate && supportsFineHoverPause()) setHoverPaused(true);
            }}
            onMouseLeave={() => {
              if (supportsFineHoverPause()) setHoverPaused(false);
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
                  eagerImage={canAnimate || i < Math.min(count, 3)}
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
