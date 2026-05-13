import type { Category } from "../../../types";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readText(textConfig: Record<string, unknown> | undefined, key: string, fb: string): string {
  if (!textConfig) return fb;
  const v = textConfig[key];
  return typeof v === "string" && v.trim() !== "" ? v : fb;
}

export function CategoriesSection(props: {
  config: Record<string, unknown>;
  categories: Category[];
  textConfig?: Record<string, unknown>;
  activeCategoryId?: number | null;
  onSelectCategory?: (categoryId: number | null) => void;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleCategories === "string" &&
    String(props.textConfig.titleCategories).trim() !== ""
      ? String(props.textConfig.titleCategories)
      : "Категории";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const allLabel = readText(props.textConfig, "allCategoriesLabel", "Все");
  const interactive = typeof props.onSelectCategory === "function";
  const active = props.activeCategoryId ?? null;

  if (!props.categories?.length) return null;

  return (
    <section className="sf-section sf-section--categories sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div
        className="sf-chips sf-chips--rail"
        role={interactive ? "tablist" : undefined}
        aria-label={title}
      >
        {interactive ? (
          <button
            type="button"
            role="tab"
            aria-selected={active === null}
            className={`sf-chip sf-chip--filter${active === null ? " sf-chip--active" : ""}`}
            onClick={() => props.onSelectCategory?.(null)}
          >
            {allLabel}
          </button>
        ) : null}
        {props.categories.map((c) =>
          interactive ? (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active === c.id}
              className={`sf-chip sf-chip--filter${active === c.id ? " sf-chip--active" : ""}`}
              onClick={() => props.onSelectCategory?.(c.id)}
            >
              {c.name}
            </button>
          ) : (
            <div key={c.id} className="sf-chip">
              {c.name}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
