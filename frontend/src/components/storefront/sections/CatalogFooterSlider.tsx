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
import { motion } from "framer-motion";
import type { Product } from "../../../types";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./CatalogFooterSlider.css";

const AUTOPLAY_MS = 5500;

type SlideRow = {
  image?: string;
  productId?: number;
  href?: string;
  caption?: string;
};

type ResolvedSlide = {
  imageUrl: string;
  caption: string;
  product?: Product;
  externalHref: string;
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
  slides: SlideRow[];
} | null {
  if (!styleConfig || typeof styleConfig !== "object") return null;
  const raw = styleConfig.catalogFooter;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    title: typeof o.title === "string" ? o.title : "Акции",
    slides: Array.isArray(o.slides) ? (o.slides as SlideRow[]) : [],
  };
}

function resolveSlide(
  slide: SlideRow,
  productById: Map<number, Product>,
): ResolvedSlide | null {
  const pid =
    typeof slide.productId === "number" && Number.isFinite(slide.productId) && slide.productId > 0
      ? slide.productId
      : undefined;
  const p = pid != null ? productById.get(pid) : undefined;
  const rawImg = typeof slide.image === "string" ? slide.image.trim() : "";
  const fromProduct = p ? productPrimaryImage(p) : "";
  const imageUrl = rawImg !== "" ? rawImg : fromProduct;
  if (imageUrl === "") return null;
  const cap = typeof slide.caption === "string" ? slide.caption.trim() : "";
  const caption = cap !== "" ? cap : (p?.name ?? "");
  const externalHref = typeof slide.href === "string" ? slide.href.trim() : "";
  return { imageUrl, caption, product: p, externalHref };
}

/** Не показываем мусорные короткие подписи вроде «f de». */
function displayCaption(slide: ResolvedSlide): string | null {
  const raw = slide.caption.trim();
  const fromProduct = slide.product?.name?.trim() ?? "";
  const text = raw.length >= 6 ? raw : fromProduct.length >= 6 ? fromProduct : "";
  return text !== "" ? text : null;
}

function slideIsActionable(slide: ResolvedSlide, onOpenProduct?: (p: Product) => void): boolean {
  if (slide.product != null && onOpenProduct) return true;
  const href = slide.externalHref;
  return href !== "" && /^https?:\/\//i.test(href);
}

function ProgressBar(props: {
  count: number;
  index: number;
  animKey: number;
  paused: boolean;
  onPick: (i: number) => void;
}): ReactElement | null {
  if (props.count <= 1) return null;
  return (
    <div className="sf-catalog-footer__progress" role="tablist" aria-label="Слайды акций">
      {Array.from({ length: props.count }, (_, i) => {
        const active = i === props.index;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Слайд ${i + 1}`}
            className="sf-catalog-footer__progress-seg"
            onClick={() => props.onPick(i)}
          >
            <span
              className={
                active
                  ? `sf-catalog-footer__progress-fill${props.paused ? " sf-catalog-footer__progress-fill--paused" : ""}`
                  : "sf-catalog-footer__progress-fill sf-catalog-footer__progress-fill--done"
              }
              style={
                active
                  ? ({
                      animationDuration: `${AUTOPLAY_MS}ms`,
                      ["--sf-footer-progress-ms" as string]: `${AUTOPLAY_MS}ms`,
                    } as CSSProperties)
                  : undefined
              }
              key={active ? `fill-${props.index}-${props.animKey}` : `done-${i}`}
            />
          </button>
        );
      })}
    </div>
  );
}

function SlideCard(props: {
  slide: ResolvedSlide;
  active: boolean;
  onOpenProduct?: (product: Product) => void;
}): ReactElement {
  const { slide: r, active } = props;
  const imgSrc = buildCloudinaryResponsiveUrl(r.imageUrl, "preview");
  const cap = displayCaption(r);
  const actionable = slideIsActionable(r, props.onOpenProduct);

  const inner = (
    <div className="sf-catalog-footer__frame">
      <div className="sf-catalog-footer__media">
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className={
            active
              ? "sf-catalog-footer__media-img sf-catalog-footer__media-img--live"
              : "sf-catalog-footer__media-img"
          }
        />
        <div className="sf-catalog-footer__shade" aria-hidden />
        <div className="sf-catalog-footer__overlay">
          {cap != null ? <p className="sf-catalog-footer__caption">{cap}</p> : null}
          {actionable ? (
            <span className="sf-catalog-footer__cta">Смотреть</span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const cardClass = "sf-catalog-footer__card";

  if (r.product != null && props.onOpenProduct) {
    return (
      <button
        type="button"
        className={`${cardClass} sf-catalog-footer__card--action`}
        onClick={() => props.onOpenProduct?.(r.product!)}
      >
        {inner}
      </button>
    );
  }

  const href = r.externalHref;
  if (href !== "" && /^https?:\/\//i.test(href)) {
    return (
      <a
        className={`${cardClass} sf-catalog-footer__card--action`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

export function CatalogFooterSlider(props: {
  storefrontStyleConfig?: Record<string, unknown> | null;
  productById: Map<number, Product>;
  onOpenProduct?: (product: Product) => void;
}): ReactElement | null {
  const cfg = readCatalogFooter(props.storefrontStyleConfig ?? undefined);
  const resolved = useMemo(() => {
    if (!cfg?.enabled) return [];
    return cfg.slides
      .map((s) => resolveSlide(s, props.productById))
      .filter((x): x is ResolvedSlide => x != null && x.imageUrl !== "");
  }, [cfg, props.productById]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = resolved.length;

  const goTo = useCallback((i: number) => {
    setSlideIndex(i);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setSlideIndex(0);
    setProgressKey((k) => k + 1);
  }, [count]);

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
        return next;
      });
      setProgressKey((k) => k + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    setPaused(true);
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start == null || count <= 1) {
        setPaused(false);
        return;
      }
      const endX = e.changedTouches[0]?.clientX;
      if (endX == null) {
        setPaused(false);
        return;
      }
      const dx = endX - start;
      const th = 44;
      if (dx < -th) {
        setSlideIndex((i) => {
          const next = i + 1 >= count ? 0 : i + 1;
          setProgressKey((k) => k + 1);
          return next;
        });
      } else if (dx > th) {
        setSlideIndex((i) => {
          const next = i <= 0 ? count - 1 : i - 1;
          setProgressKey((k) => k + 1);
          return next;
        });
      }
      window.setTimeout(() => setPaused(false), 400);
    },
    [count],
  );

  if (!cfg?.enabled || resolved.length === 0) return null;

  const title = cfg.title.trim() !== "" ? cfg.title : "Акции";
  const safeIndex = Math.min(slideIndex, Math.max(resolved.length - 1, 0));

  return (
    <section
      className="sf-catalog-footer"
      aria-label={title}
      aria-roledescription="carousel"
    >
      <div className="sf-catalog-footer__head">
        <span className="sf-catalog-footer__title">{title}</span>
        {count > 1 ? (
          <span className="sf-catalog-footer__counter">
            {safeIndex + 1}/{count}
          </span>
        ) : null}
      </div>

      <div
        className="sf-catalog-footer__viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div className="sf-catalog-footer__stack">
          {resolved.map((slide, i) => (
            <motion.div
              key={`${i}-${slide.imageUrl.slice(0, 32)}`}
              className="sf-catalog-footer__layer"
              initial={false}
              animate={{
                opacity: i === safeIndex ? 1 : 0,
                scale: i === safeIndex ? 1 : 1.03,
              }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              style={{
                zIndex: i === safeIndex ? 2 : 1,
                pointerEvents: i === safeIndex ? "auto" : "none",
              }}
              aria-hidden={i !== safeIndex}
            >
              <SlideCard
                slide={slide}
                active={i === safeIndex}
                onOpenProduct={props.onOpenProduct}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <ProgressBar
        count={count}
        index={safeIndex}
        animKey={progressKey}
        paused={paused}
        onPick={goTo}
      />
    </section>
  );
}
