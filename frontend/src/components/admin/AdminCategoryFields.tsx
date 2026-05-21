import type { Category } from "../../types";
import { categoryRoots } from "../../utils/categoryTree";

type Props = {
  categories: Category[];
  mainCategoryId: number | "";
  subCategoryId: number | "";
  onMainChange: (id: number) => void;
  onSubChange: (id: number | "") => void;
  mainSelectId?: string;
  subSelectId?: string;
};

export function AdminCategoryFields({
  categories,
  mainCategoryId,
  subCategoryId,
  onMainChange,
  onSubChange,
  mainSelectId = "admin-main-category",
  subSelectId = "admin-sub-category",
}: Props) {
  const rootCategories = categoryRoots(categories);

  if (rootCategories.length === 0) {
    return (
      <div className="admin-form-section admin-empty-categories">
        <span className="admin-field-label">Категория</span>
        <p className="admin-form-hint">
          Категорий пока нет — создайте первую, чтобы добавлять товары.
        </p>
        <a href="#/admin/categories" className="admin-secondary-btn">
          Создать категорию
        </a>
      </div>
    );
  }

  const subOptions =
    rootCategories.find((c) => c.id === mainCategoryId)?.children ?? [];

  return (
    <>
      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor={mainSelectId}>
          Категория
        </label>
        <select
          id={mainSelectId}
          className="admin-select"
          value={mainCategoryId}
          onChange={(e) => {
            const nextMainId = Number(e.target.value);
            onMainChange(nextMainId);
            const nextMain = rootCategories.find((c) => c.id === nextMainId);
            onSubChange(nextMain?.children?.[0]?.id ?? "");
          }}
        >
          {rootCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {subOptions.length > 0 ? (
        <div className="admin-form-section">
          <label className="admin-field-label" htmlFor={subSelectId}>
            Подкатегория
          </label>
          <select
            id={subSelectId}
            className="admin-select"
            value={subCategoryId}
            onChange={(e) => {
              const v = e.target.value;
              onSubChange(v === "" ? "" : Number(v));
            }}
          >
            <option value="">Выберите подкатегорию</option>
            {subOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
