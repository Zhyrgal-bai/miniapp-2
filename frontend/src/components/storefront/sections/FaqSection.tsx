import { useTheme } from "../../../context/ThemeContext";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readItems(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.items;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

export function FaqSection(props: {
  config: Record<string, unknown>;
}): React.ReactElement | null {
  const { theme } = useTheme();
  const title = readTitle(props.config, "FAQ");
  const items = readItems(props.config);
  if (items.length === 0) return null;

  return (
    <section style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it, idx) => {
          const q = typeof it.q === "string" ? it.q : "";
          const a = typeof it.a === "string" ? it.a : "";
          return (
            <div
              key={idx}
              style={{
                borderRadius: 14,
                border: `1px solid ${theme.textColor}22`,
                background: "transparent",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>{q}</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>{a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

