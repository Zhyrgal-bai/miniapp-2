import type { Category } from "../../../types";
import { ArchaOverlay } from "../../ui/ArchaOverlay";
import "../../ui/archaOverlay.css";
import "./CategoryPickerSheet.css";

function itemClass(active: boolean, extra = ""): string {
  return `sf-category-picker-sheet__item${extra}${active ? " sf-category-picker-sheet__item--active" : ""}`;
}

export function CategoryPickerSheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  allLabel: string;
  categories: Category[];
  activeCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}): React.ReactElement | null {
  const select = (id: number | null) => {
    props.onSelectCategory(id);
    props.onClose();
  };

  return (
    <ArchaOverlay
      open={props.open}
      onClose={props.onClose}
      ariaLabel={props.title}
      panelClassName="sf-category-picker-sheet"
      scrollClassName="sf-category-picker-sheet__scroll"
      header={
        <div className="sf-category-picker-sheet__header">
          <h2 className="sf-category-picker-sheet__title">{props.title}</h2>
        </div>
      }
    >
      <div className="sf-category-picker-sheet__list" role="listbox" aria-label={props.title}>
        <button
          type="button"
          role="option"
          aria-selected={props.activeCategoryId === null}
          className={itemClass(props.activeCategoryId === null, " sf-category-picker-sheet__item--all")}
          onClick={() => select(null)}
        >
          {props.allLabel}
        </button>

        {props.categories.map((root) => {
          const children = root.children ?? [];
          const rootActive = props.activeCategoryId === root.id;
          const childActive = children.some((ch) => ch.id === props.activeCategoryId);

          return (
            <section
              key={root.id}
              className={`sf-category-picker-sheet__group${childActive ? " sf-category-picker-sheet__group--child-active" : ""}`}
              role="group"
              aria-label={root.name}
            >
              <button
                type="button"
                role="option"
                aria-selected={rootActive}
                className={itemClass(rootActive, " sf-category-picker-sheet__item--root")}
                onClick={() => select(root.id)}
              >
                <span className="sf-category-picker-sheet__item-label">{root.name}</span>
                {children.length > 0 ? (
                  <span className="sf-category-picker-sheet__item-meta">
                    {children.length}{" "}
                    {children.length === 1 ? "подкатегория" : "подкатегории"}
                  </span>
                ) : null}
              </button>

              {children.length > 0 ? (
                <div className="sf-category-picker-sheet__subgrid" role="presentation">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      role="option"
                      aria-selected={props.activeCategoryId === child.id}
                      className={itemClass(
                        props.activeCategoryId === child.id,
                        " sf-category-picker-sheet__item--sub",
                      )}
                      onClick={() => select(child.id)}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </ArchaOverlay>
  );
}
