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
}): React.ReactElement {
  const slides = readSlides(props.config);
  const first = slides[0] ?? {};
  const defaultTitle =
    readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle").trim() !== ""
      ? readTextConfigString(props.textConfig ?? undefined, "heroDefaultTitle")
      : "Добро пожаловать";
  const title =
    readString(first, "title").trim() !== ""
      ? readString(first, "title")
      : defaultTitle;
  const subtitle =
    readString(first, "subtitle").trim() !== ""
      ? readString(first, "subtitle")
      : "";
  const imageUrlRaw = readString(first, "imageUrl");
  const imageUrl = buildCloudinaryResponsiveUrl(imageUrlRaw, "preview");
  const kit = props.kit ?? "default";

  // Structural divergence: editorial split for fashion, boutique overlay for luxury.
  if (kit === "fashion") {
    return (
      <section className="sf-section sf-section--hero" style={{ padding: "var(--sf-section-pad)" }}>
        <div className="sf-hero sf-hero--fashion">
          <div className="sf-hero__copy">
            <div className="sf-hero__kicker">EDITORIAL</div>
            <div className="sf-hero__title">{title}</div>
            {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
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
        <div className="sf-hero sf-hero--luxury">
          {imageUrl ? (
            <div className="sf-hero__media">
              <img src={imageUrl} alt="" loading="lazy" />
              <div className="sf-hero__overlay">
                <div className="sf-hero__title">{title}</div>
                {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
              </div>
            </div>
          ) : (
            <div className="sf-hero__overlay sf-hero__overlay--noimg">
              <div className="sf-hero__title">{title}</div>
              {subtitle ? <div className="sf-hero__subtitle">{subtitle}</div> : null}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sf-section sf-section--hero" style={{ padding: "var(--sf-section-pad)" }}>
      <div
        style={{
          borderRadius: "var(--sf-section-radius)",
          overflow: "hidden",
          border: "1px solid var(--sf-color-border)",
          background: "var(--sf-color-card)",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: "100%", maxHeight: 220, objectFit: "cover" }}
            loading="lazy"
          />
        ) : null}
        <div style={{ padding: "var(--sf-space-md)" }}>
          <div style={{ fontSize: "var(--sf-font-size-h2, 22px)", fontWeight: "var(--sf-font-weight-heading, 800)" }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

