import type { Category } from "../../../types";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export function CategoriesSection(props: {
  config: Record<string, unknown>;
  categories: Category[];
}): React.ReactElement | null {
  const title = readTitle(props.config, "Категории");
  if (!props.categories?.length) return null;

  return (
    <section className="sf-section sf-section--categories" style={{ padding: "var(--sf-section-pad)" }}>
      <div style={{ fontWeight: 800, marginBottom: "var(--sf-space-sm)" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sf-space-sm)" }}>
        {props.categories.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "8px 10px",
              borderRadius: "var(--sf-radius-full)",
              border: "1px solid var(--sf-color-border)",
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

