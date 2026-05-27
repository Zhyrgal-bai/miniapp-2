import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type TouchEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "../../../types";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./CatalogFooterSlider.css";

const AUTOPLAY_MS = 5000;

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

function FooterDots(props: {
  count: number;
  index: number;
  onPick: (i: number) => void;
}): ReactElement | null {
  if (props.count <= 1) return null;
  return (
    <div className="sf-catalog-footer__dots" role="tablist" aria-label="Слайды акций">
      {Array.from({ length: props.count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === props.index}
          aria-label={`Слайд ${i + 1}`}
          className={
            i === props.index
              ? "sf-catalog-footer__dot sf-catalog-footer__dot--active"
              : "sf-catalog-footer__dot"
          }
          onClick={() => props.onPick(i)}
        />
      ))}
    </div>
  );
}

function SlideCard(props: {
  slide: ResolvedSlide;
  onOpenProduct?: (product: Product) => void;
}): ReactElement {
  const { slide: r } = props;
  const imgSrc = buildCloudinaryResponsiveUrl(r.imageUrl, "thumbnail");
  const cap = r.caption.trim() !== "" ? r.caption : null;
  const inner = (
    <>
      <div className="sf-catalog-footer__media">
        <img src={imgSrc} alt="" loading="lazy" decoding="async" />
      </div>
      {cap != null ? <div className="sf-catalog-footer__caption">{cap}</div> : null}
    </>
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
  const touchStartX = useRef<number | null>(null);
  const count = resolved.length;

  useEffect(() => {
    setSlideIndex(0);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return undefined;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSlideIndex((i) => (i + 1 >= count ? 0 : i + 1));
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start == null || count <= 1) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX == null) return;
      const dx = endX - start;
      const th = 44;
      if (dx < -th) {
        setSlideIndex((i) => (i + 1 >= count ? 0 : i + 1));
      } else if (dx > th) {
        setSlideIndex((i) => (i <= 0 ? count - 1 : i - 1));
      }
    },
    [count],
  );

  if (!cfg?.enabled || resolved.length === 0) return null;

  const title = cfg.title.trim() !== "" ? cfg.title : "Акции";
  const safeIndex = Math.min(slideIndex, Math.max(resolved.length - 1, 0));
  const current = resolved[safeIndex]!;
  return (
    <section
      className="sf-catalog-footer"
      aria-label={title}
      aria-roledescription="carousel"
    >
      <div className="sf-catalog-footer__head">
        <span className="sf-catalog-footer__title">{title}</span>
      </div>
      <div
        className="sf-catalog-footer__viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={safeIndex}
            className="sf-catalog-footer__slide"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <SlideCard slide={current} onOpenProduct={props.onOpenProduct} />
          </motion.div>
        </AnimatePresence>
      </div>
      <FooterDots count={count} index={safeIndex} onPick={setSlideIndex} />
    </section>
  );
}
