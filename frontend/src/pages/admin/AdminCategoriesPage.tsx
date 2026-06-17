import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { showErrorToast, showSuccessToast } from "../../store/toast.store";
import { formatAdminApiError } from "../../utils/adminApiError";
import type { Category } from "../../types";
import { categoryRoots, flattenCategories } from "../../utils/categoryTree";

function CategoryNodeEditor({
  node,
  allFlat,
  rootOptions,
  onChanged,
}: {
  node: Category;
  allFlat: Category[];
  rootOptions: Category[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [parentId, setParentId] = useState<number | "">(
    node.parentId ?? "",
  );

  useEffect(() => {
    setName(node.name);
    setParentId(node.parentId ?? "");
  }, [node.id, node.name, node.parentId]);

  const siblings = useMemo(() => {
    const pid = node.parentId ?? null;
    return allFlat
      .filter((c) => (c.parentId ?? null) === pid)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  }, [allFlat, node.parentId]);

  const siblingIndex = siblings.findIndex((s) => s.id === node.id);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === node.name) return;
    try {
      await adminService.updateCategory(node.id, { name: trimmed });
      onChanged();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function saveParent() {
    const next = parentId === "" ? null : parentId;
    const current = node.parentId ?? null;
    if (next === current) return;
    try {
      await adminService.updateCategory(node.id, { parentId: next });
      onChanged();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function move(direction: "up" | "down") {
    const idx = siblingIndex;
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const a = siblings[idx]!;
    const b = siblings[targetIdx]!;
    const aOrder = a.sortOrder ?? idx;
    const bOrder = b.sortOrder ?? targetIdx;
    try {
      await adminService.reorderCategories([
        { id: a.id, sortOrder: bOrder },
        { id: b.id, sortOrder: aOrder },
      ]);
      onChanged();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function onDelete(id: number) {
    try {
      await adminService.deleteCategory(id);
      onChanged();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  return (
    <div className={`admin-cat-node${node.parentId != null ? " admin-cat-node--child" : ""}`}>
      <input
        className="admin-input admin-cat-node__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void saveName()}
      />
      <select
        className="admin-select admin-cat-node__parent"
        value={parentId}
        onChange={(e) => {
          const v = e.target.value === "" ? "" : Number(e.target.value);
          setParentId(v);
        }}
        onBlur={() => void saveParent()}
      >
        <option value="">Main категория</option>
        {rootOptions
          .filter((r) => r.id !== node.id)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </select>
      <span className="admin-cat-node__count">{node.productsCount ?? 0} товаров</span>
      <div className="admin-cat-node__actions">
        <button type="button" className="admin-pm-card__btn" onClick={() => void move("up")}>
          ↑
        </button>
        <button type="button" className="admin-pm-card__btn" onClick={() => void move("down")}>
          ↓
        </button>
        <button type="button" className="delete" onClick={() => void onDelete(node.id)}>
          Удалить
        </button>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
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
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
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

  const onRestoreDefaults = async () => {
    setRestoring(true);
    try {
      const result = await adminService.restoreDefaultCategories();
      await load();
      showSuccessToast(
        result.created > 0
          ? `Восстановлено категорий: ${result.created}`
          : "Стандартные категории уже на месте",
      );
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Категории</h1>
        <p className="admin-dash-page__subtitle">
          Дерево категорий: переименование, перемещение, порядок на витрине.
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
            Категорий нет — они могли быть удалены. Восстановите стандартный набор для
            вашего типа магазина или создайте категорию вручную.
          </p>
          <button
            type="button"
            className="admin-submit-btn"
            disabled={restoring}
            onClick={() => void onRestoreDefaults()}
          >
            {restoring ? "Восстановление…" : "Восстановить стандартные категории"}
          </button>
        </div>
      )}

      {!loading && rootCategories.length > 0 && (
        <div className="admin-dash-card">
          <div className="admin-form-section" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="admin-secondary-btn"
              disabled={restoring}
              onClick={() => void onRestoreDefaults()}
            >
              {restoring ? "Восстановление…" : "Добавить недостающие стандартные"}
            </button>
          </div>
          {rootCategories.map((main) => (
            <div key={main.id} className="admin-cat-tree">
              <CategoryNodeEditor
                node={main}
                allFlat={flatCategories}
                rootOptions={rootCategories}
                onChanged={load}
              />
              <div className="admin-cat-children">
                {(main.children ?? []).map((sub) => (
                  <CategoryNodeEditor
                    key={sub.id}
                    node={sub}
                    allFlat={flatCategories}
                    rootOptions={rootCategories}
                    onChanged={load}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
