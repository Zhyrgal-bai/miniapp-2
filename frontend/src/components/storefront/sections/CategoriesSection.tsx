import { useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "../../../types";
import { CategoryPickerSheet } from "./CategoryPickerSheet";
import "./CategoryPickerSheet.css";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readText(textConfig: Record<string, unknown> | undefined, key: string, fb: string): string {
  if (!textConfig) return fb;
  const v = textConfig[key];
  return typeof v === "string" && v.trim() !== "" ? v : fb;
}

const MORE_BUTTON_MIN_CATEGORIES = 3;

export function CategoriesSection(props: {
  config: Record<string, unknown>;
  categories: Category[];
  textConfig?: Record<string, unknown>;
  activeCategoryId?: number | null;
  onSelectCategory?: (categoryId: number | null) => void;
  /** Скрыть заголовок — компактные pills под поиском. */
  compact?: boolean;
}): React.ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleCategories === "string" &&
    String(props.textConfig.titleCategories).trim() !== ""
      ? String(props.textConfig.titleCategories)
      : "Категории";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const allLabel = readText(props.textConfig, "allCategoriesLabel", "Все");
  const moreLabel = readText(props.textConfig, "categoriesMoreLabel", "Ещё");
  const interactive = typeof props.onSelectCategory === "function";
  const active = props.activeCategoryId ?? null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const showMoreButton = interactive && props.categories.length >= MORE_BUTTON_MIN_CATEGORIES;

  const activeCategoryName = useMemo(() => {
    if (active == null) return null;
    for (const c of props.categories) {
      if (c.id === active) return c.name;
      for (const child of c.children ?? []) {
        if (child.id === active) return child.name;
      }
    }
    return null;
  }, [active, props.categories]);

  const moreButtonActive =
    active != null &&
    activeCategoryName != null &&
    !props.categories.some((c) => c.id === active);

  useEffect(() => {
    if (active == null || !railRef.current) return;
    const chip = railRef.current.querySelector<HTMLElement>(`[data-category-id="${active}"]`);
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  if (!props.categories?.length) return null;

  return (
    <section
      className={`sf-section sf-section--categories sf-section--padded sf-categories-sticky-wrap${props.compact ? " sf-section--compact" : ""}`}
    >
      <div className="sf-categories-sticky">
        {!props.compact ? (
          <div className="sf-section__title sf-section__title--compact">{title}</div>
        ) : null}
        <div className={`sf-categories-rail-row${showMoreButton ? " sf-categories-rail-row--with-more" : ""}`}>
          <div
            ref={railRef}
            className="sf-chips sf-chips--rail sf-chips--sticky"
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
                  data-category-id={c.id}
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
          {showMoreButton ? (
            <button
              type="button"
              className={`sf-categories-more-btn${moreButtonActive || sheetOpen ? " sf-categories-more-btn--active" : ""}`}
              aria-label={`${moreLabel}: ${title}`}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <span className="sf-categories-more-btn__label">{moreLabel}</span>
              <span className="sf-categories-more-btn__icon" aria-hidden>
                ▾
              </span>
            </button>
          ) : null}
        </div>
      </div>
      {showMoreButton ? (
        <CategoryPickerSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={title}
          allLabel={allLabel}
          categories={props.categories}
          activeCategoryId={active}
          onSelectCategory={(id) => props.onSelectCategory?.(id)}
        />
      ) : null}
    </section>
  );
}
