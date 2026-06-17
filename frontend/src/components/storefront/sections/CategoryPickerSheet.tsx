import type { Category } from "../../../types";
import { ArchaOverlay } from "../../ui/ArchaOverlay";
import "../../ui/archaOverlay.css";
import "./CategoryPickerSheet.css";

type PickerRow = { id: number; name: string; depth: number };

function flattenCategories(categories: Category[]): PickerRow[] {
  const rows: PickerRow[] = [];
  for (const c of categories) {
    rows.push({ id: c.id, name: c.name, depth: 0 });
    for (const child of c.children ?? []) {
      rows.push({ id: child.id, name: child.name, depth: 1 });
    }
  }
  return rows;
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
  const rows = flattenCategories(props.categories);

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
      <div className="sf-category-picker-sheet__grid" role="listbox" aria-label={props.title}>
        <button
          type="button"
          role="option"
          aria-selected={props.activeCategoryId === null}
          className={`sf-category-picker-sheet__item${props.activeCategoryId === null ? " sf-category-picker-sheet__item--active" : ""}`}
          onClick={() => {
            props.onSelectCategory(null);
            props.onClose();
          }}
        >
          {props.allLabel}
        </button>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            role="option"
            aria-selected={props.activeCategoryId === row.id}
            className={`sf-category-picker-sheet__item${row.depth > 0 ? " sf-category-picker-sheet__item--child" : ""}${props.activeCategoryId === row.id ? " sf-category-picker-sheet__item--active" : ""}`}
            onClick={() => {
              props.onSelectCategory(row.id);
              props.onClose();
            }}
          >
            {row.name}
          </button>
        ))}
      </div>
    </ArchaOverlay>
  );
}
