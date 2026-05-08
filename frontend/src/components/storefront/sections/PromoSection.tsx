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
    <section className="sf-section sf-section--promo" style={{ padding: "var(--sf-section-pad)" }}>
      <div style={{ display: "grid", gap: "var(--sf-section-gap)" }}>
        {blocks.map((b, idx) => {
          const title = readString(b, "title");
          const subtitle = readString(b, "subtitle");
          const imageUrl = buildCloudinaryResponsiveUrl(readString(b, "imageUrl"), "storefront");
          return (
            <div
              key={`${idx}-${title}`}
              style={{
                borderRadius: "var(--sf-section-radius)",
                border: "1px solid var(--sf-color-border)",
                background: "var(--sf-color-card)",
                overflow: "hidden",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: "100%", maxHeight: 160, objectFit: "cover" }}
                  loading="lazy"
                />
              ) : null}
              <div style={{ padding: "var(--sf-space-md)" }}>
                <div style={{ fontWeight: 700 }}>{title}</div>
                {subtitle ? (
                  <div style={{ marginTop: 4, opacity: 0.8 }}>{subtitle}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

