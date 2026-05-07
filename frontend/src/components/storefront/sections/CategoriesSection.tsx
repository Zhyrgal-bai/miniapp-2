import type { Category } from "../../../types";
import { useTheme } from "../../../context/ThemeContext";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export function CategoriesSection(props: {
  config: Record<string, unknown>;
  categories: Category[];
}): React.ReactElement | null {
  const { theme } = useTheme();
  const title = readTitle(props.config, "Категории");
  if (!props.categories?.length) return null;

  return (
    <section style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {props.categories.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: `1px solid ${theme.textColor}22`,
              background: "transparent",
              opacity: 0.95,
            }}
          >
            {c.name}
          </div>
        ))}
      </div>
    </section>
  );
}

