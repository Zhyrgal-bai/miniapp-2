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
      <div className="sf-section__title">{title}</div>
      <div className="sf-chips">
        {props.categories.map((c) => (
          <div key={c.id} className="sf-chip">
            {c.name}
          </div>
        ))}
      </div>
    </section>
  );
}

