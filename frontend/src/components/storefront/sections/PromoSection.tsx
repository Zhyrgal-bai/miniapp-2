import { buildCloudinaryResponsiveUrl } from "../../../utils/cloudinaryTransforms";

function readString(obj: unknown, key: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return "";
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function readBlocks(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.blocks;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

export function PromoSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const blocks = readBlocks(props.config);
  if (blocks.length === 0) return null;
  const variantRaw = readString(props.config, "variant").trim().toLowerCase();
  const variant =
    variantRaw === "split" || variantRaw === "ticker" || variantRaw === "spotlight"
      ? variantRaw
      : "spotlight";
  const sectionTitle =
    readString(props.config, "title").trim() ||
    (typeof props.textConfig?.bannerEngineTitle === "string" ? props.textConfig.bannerEngineTitle.trim() : "");

  const openExternal = (url: string) => {
    const href = String(url).trim();
    if (href === "") return;
    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        window.open(parsed.toString(), "_blank", "noopener,noreferrer");
      }
    } catch {
      /* ignore invalid URL */
    }
  };

  return (
    <section className="sf-section sf-section--promo sf-section--padded sf-banner-engine" data-sf-banner={variant}>
      {sectionTitle ? <div className="sf-section__title">{sectionTitle}</div> : null}
      <div className={`sf-section-grid sf-banner-engine__grid sf-banner-engine__grid--${variant}`}>
        {blocks.map((b, idx) => {
          const title = readString(b, "title");
          const subtitle = readString(b, "subtitle");
          const badge = readString(b, "badge");
          const ctaText = readString(b, "ctaText");
          const ctaUrl = readString(b, "ctaUrl");
          const imageUrl = buildCloudinaryResponsiveUrl(readString(b, "imageUrl"), "storefront");
          return (
            <div key={`${idx}-${title}`} className="sf-section-card sf-banner-card">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="sf-section-media"
                  loading="lazy"
                />
              ) : null}
              <div className="sf-section-card__body">
                {badge ? <div className="sf-banner-card__badge">{badge}</div> : null}
                <div className="sf-section-card__title">{title}</div>
                {subtitle ? <div className="sf-section-card__text">{subtitle}</div> : null}
                {ctaText && ctaUrl ? (
                  <button
                    type="button"
                    className="sf-banner-card__cta"
                    onClick={() => openExternal(ctaUrl)}
                  >
                    {ctaText}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

