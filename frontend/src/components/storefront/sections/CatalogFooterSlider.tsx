import type { ReactElement } from "react";
import "./CatalogFooterSlider.css";

type CatalogFooterSlide = {
  image: string;
  href?: string;
  caption?: string;
};

function readCatalogFooter(styleConfig: Record<string, unknown> | null | undefined): {
  enabled: boolean;
  title: string;
  slides: CatalogFooterSlide[];
} | null {
  if (!styleConfig || typeof styleConfig !== "object") return null;
  const raw = styleConfig.catalogFooter;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    title: typeof o.title === "string" ? o.title : "Акции",
    slides: Array.isArray(o.slides) ? (o.slides as CatalogFooterSlide[]) : [],
  };
}

export function CatalogFooterSlider(props: {
  storefrontStyleConfig?: Record<string, unknown> | null;
}): ReactElement | null {
  const cfg = readCatalogFooter(props.storefrontStyleConfig ?? undefined);
  if (!cfg?.enabled) return null;
  const slides = cfg.slides.filter((s) => typeof s.image === "string" && s.image.trim() !== "");
  if (slides.length === 0) return null;

  const title = cfg.title.trim() !== "" ? cfg.title : "Акции";

  return (
    <section className="sf-catalog-footer" aria-label={title}>
      <div className="sf-catalog-footer__head">
        <span className="sf-catalog-footer__title">{title}</span>
      </div>
      <div className="sf-catalog-footer__track" role="region">
        {slides.map((s, i) => {
          const href = typeof s.href === "string" ? s.href.trim() : "";
          const cap = typeof s.caption === "string" ? s.caption.trim() : "";
          const inner = (
            <>
              <div className="sf-catalog-footer__media">
                <img src={s.image} alt="" loading="lazy" decoding="async" />
              </div>
              {cap !== "" ? <div className="sf-catalog-footer__caption">{cap}</div> : null}
            </>
          );
          const cardClass = "sf-catalog-footer__card";
          if (href !== "" && /^https?:\/\//i.test(href)) {
            return (
              <a
                key={`${i}-${s.image.slice(0, 48)}`}
                className={cardClass}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            );
          }
          return (
            <div key={`${i}-${s.image.slice(0, 48)}`} className={cardClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
