import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";

function readString(obj: unknown, key: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return "";
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function readTextConfigString(cfg: unknown, key: string): string {
  if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) return "";
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function readSlides(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.slides;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

export function HeroSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  heroStyle?: Record<string, unknown>;
}): React.ReactElement {
  const slides = readSlides(props.config);
  const first = slides[0] ?? {};
  const defaultTitle =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle")
      : "Добро пожаловать";
  const defaultSubtitle =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultSubtitle").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultSubtitle")
      : "";
  const defaultCta =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultCta").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultCta")
      : "";
  const title =
    readString(first, "title").trim() !== ""
      ? readString(first, "title")
      : defaultTitle;
  const subtitle =
    readString(first, "subtitle").trim() !== ""
      ? readString(first, "subtitle")
      : defaultSubtitle;
  const ctaText =
    readString(first, "ctaText").trim() !== ""
      ? readString(first, "ctaText")
      : defaultCta;
  const imageUrlRaw = readString(first, "imageUrl");
  const imageUrl = buildCloudinaryResponsiveUrl(imageUrlRaw, "preview");
  const kit = props.kit ?? "default";
  const hs = props.heroStyle ?? {};
  const layoutRaw = typeof hs.layout === "string" ? hs.layout : "";
  const layout: "centered" | "split" | "banner" | "editorial" | "" =
    layoutRaw === "split" || layoutRaw === "banner" || layoutRaw === "editorial" || layoutRaw === "centered"
      ? (layoutRaw as "split" | "banner" | "editorial" | "centered")
      : "";
  const heroClass = layout ? `sf-hero sf-hero--${layout}` : "sf-hero";
  const ctaPosRaw = typeof hs.ctaPosition === "string" ? hs.ctaPosition : "";
  const ctaPosition: "below" | "overlay" | "hidden" =
    ctaPosRaw === "overlay" || ctaPosRaw === "hidden" ? (ctaPosRaw as "overlay" | "hidden") : "below";

  // Structural divergence: editorial split for fashion, boutique overlay for luxury.
  if (kit === "fashion") {
    return (
      <section className="sf-section sf-section--hero" style={{ padding: "var(--sf-section-pad)" }}>
        <div className={`${heroClass} sf-hero--fashion`}>
          <div className="sf-hero__copy">
            <div className="sf-hero__kicker">EDITORIAL</div>
            <div className="sf-hero__title">{title}</div>
            {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
            {ctaText && ctaPosition !== "hidden" ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="sf-hero__cta">
                  {ctaText}
                </button>
              </div>
            ) : null}
          </div>
          <div className="sf-hero__media">
            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (kit === "luxury") {
    return (
      <section className="sf-section sf-section--hero" style={{ padding: "var(--sf-section-pad)" }}>
        <div className={`${heroClass} sf-hero--luxury`}>
          {imageUrl ? (
            <div className="sf-hero__media">
              <img src={imageUrl} alt="" loading="lazy" />
              <div className="sf-hero__overlay">
                <div className="sf-hero__title">{title}</div>
                {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
                {ctaText && ctaPosition !== "hidden" ? (
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="sf-hero__cta">
                      {ctaText}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="sf-hero__overlay sf-hero__overlay--noimg">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition !== "hidden" ? (
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="sf-hero__cta">
                    {ctaText}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sf-section sf-section--hero" style={{ padding: "var(--sf-section-pad)" }}>
      <div className={`${heroClass} sf-hero--centered`}>
        <div className="sf-hero__media">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          <div className="sf-hero__overlay">
            <div className="sf-hero__body">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              {ctaText && ctaPosition === "overlay" ? <button type="button" className="sf-hero__cta">{ctaText}</button> : null}
            </div>
          </div>
        </div>
        {ctaText && ctaPosition === "below" ? (
          <div className="sf-hero__below">
            <button type="button" className="sf-hero__cta">{ctaText}</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

