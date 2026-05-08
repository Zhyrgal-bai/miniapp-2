import { useTheme } from "../../../context/ThemeContext";
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
  const { theme } = useTheme();
  const blocks = readBlocks(props.config);
  if (blocks.length === 0) return null;

  return (
    <section style={{ padding: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {blocks.map((b, idx) => {
          const title = readString(b, "title");
          const subtitle = readString(b, "subtitle");
          const imageUrl = buildCloudinaryResponsiveUrl(readString(b, "imageUrl"), "storefront");
          return (
            <div
              key={`${idx}-${title}`}
              style={{
                borderRadius: 14,
                border: `1px solid ${theme.primaryColor}22`,
                background: theme.cardColor,
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
              <div style={{ padding: 12 }}>
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

