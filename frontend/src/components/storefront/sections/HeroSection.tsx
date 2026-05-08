import { useTheme } from "../../../context/ThemeContext";
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
}): React.ReactElement {
  const { theme } = useTheme();
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

  return (
    <section style={{ padding: 16 }}>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${theme.primaryColor}22`,
          background: theme.cardColor,
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
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 6, opacity: 0.85 }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

