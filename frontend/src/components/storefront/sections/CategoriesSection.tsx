import type { Category } from "../../../types";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export function CategoriesSection(props: {
  config: Record<string, unknown>;
  categories: Category[];
  textConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleCategories === "string" && String(props.textConfig.titleCategories).trim() !== ""
      ? String(props.textConfig.titleCategories)
      : "Категории";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  if (!props.categories?.length) return null;

  return (
    <section className="sf-section sf-section--categories sf-section--padded">
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

