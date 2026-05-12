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
}): React.ReactElement | null {
  const blocks = readBlocks(props.config);
  if (blocks.length === 0) return null;

  return (
    <section className="sf-section sf-section--promo sf-section--padded">
      <div className="sf-section-grid">
        {blocks.map((b, idx) => {
          const title = readString(b, "title");
          const subtitle = readString(b, "subtitle");
          const imageUrl = buildCloudinaryResponsiveUrl(readString(b, "imageUrl"), "storefront");
          return (
            <div key={`${idx}-${title}`} className="sf-section-card">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="sf-section-media"
                  loading="lazy"
                />
              ) : null}
              <div className="sf-section-card__body">
                <div className="sf-section-card__title">{title}</div>
                {subtitle ? <div className="sf-section-card__text">{subtitle}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

