import type { ReactElement } from "react";
import type { Product } from "../../../types";
import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";
import "./CatalogFooterSlider.css";

type SlideRow = {
  image?: string;
  productId?: number;
  href?: string;
  caption?: string;
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
): { imageUrl: string; caption: string; product?: Product; externalHref: string } | null {
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

export function CatalogFooterSlider(props: {
  storefrontStyleConfig?: Record<string, unknown> | null;
  productById: Map<number, Product>;
  onOpenProduct?: (product: Product) => void;
}): ReactElement | null {
  const cfg = readCatalogFooter(props.storefrontStyleConfig ?? undefined);
  if (!cfg?.enabled) return null;

  const resolved = cfg.slides
    .map((s) => resolveSlide(s, props.productById))
    .filter((x): x is NonNullable<typeof x> => x != null && x.imageUrl !== "");
  if (resolved.length === 0) return null;

  const title = cfg.title.trim() !== "" ? cfg.title : "Акции";

  return (
    <section className="sf-catalog-footer" aria-label={title}>
      <div className="sf-catalog-footer__head">
        <span className="sf-catalog-footer__title">{title}</span>
      </div>
      <div className="sf-catalog-footer__track" role="region">
        {resolved.map((r, i) => {
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
          const key = `${i}-${r.imageUrl.slice(0, 40)}`;

          if (r.product != null && props.onOpenProduct) {
            return (
              <button
                key={key}
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
                key={key}
                className={`${cardClass} sf-catalog-footer__card--action`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            );
          }

          return (
            <div key={key} className={cardClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
