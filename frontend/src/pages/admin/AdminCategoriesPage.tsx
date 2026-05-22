import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { showErrorToast } from "../../store/toast.store";
import { formatAdminApiError } from "../../utils/adminApiError";
import type { Category } from "../../types";
import { categoryRoots } from "../../utils/categoryTree";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await adminService.getCategories();
      setCategories(tree);
      setError(null);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rootCategories = useMemo(() => categoryRoots(categories), [categories]);
  const parentOptions = rootCategories;

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await adminService.createCategory({
        name: name.trim(),
        parentId: parentId === "" ? null : parentId,
      });
      setName("");
      await load();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  };

  const onDelete = async (id: number) => {
    try {
      await adminService.deleteCategory(id);
      await load();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  };

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Категории</h1>
        <p className="admin-dash-page__subtitle">
          Дерево категорий каталога: main категории и подкатегории.
        </p>
      </header>

      <div className="admin-dash-card admin-form">
        <div className="admin-form-section">
          <label className="admin-field-label" htmlFor="cat-name">
            Название
          </label>
          <input
            id="cat-name"
            className="admin-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Худи"
          />
        </div>
        <div className="admin-form-section">
          <label className="admin-field-label" htmlFor="cat-parent">
            Родитель (пусто = main категория)
          </label>
          <select
            id="cat-parent"
            className="admin-select"
            value={parentId}
            onChange={(e) =>
              setParentId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">Без родителя</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="admin-submit-btn" onClick={() => void onCreate()}>
          Создать категорию
        </button>
      </div>

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}
      {error && <div className="admin-form-error">{error}</div>}

      {!loading && rootCategories.length === 0 && (
        <div className="admin-dash-card admin-empty-categories">
          <p className="admin-form-hint">
            Категорий пока нет. Создайте main-категорию (например «Букеты») или
            подкатегорию для существующей.
          </p>
        </div>
      )}

      {!loading && rootCategories.length > 0 && (
        <div className="admin-dash-card">
          {rootCategories.map((main) => (
            <div key={main.id} className="admin-cat-tree">
              <div className="admin-cat-node">
                <strong>{main.name}</strong>
                <span>{main.productsCount ?? 0} товаров</span>
                <button type="button" className="delete" onClick={() => void onDelete(main.id)}>
                  Удалить
                </button>
              </div>
              <div className="admin-cat-children">
                {(main.children ?? []).map((sub) => (
                  <div key={sub.id} className="admin-cat-node admin-cat-node--child">
                    <span>{sub.name}</span>
                    <span>{sub.productsCount ?? 0} товаров</span>
                    <button
                      type="button"
                      className="delete"
                      onClick={() => void onDelete(sub.id)}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
