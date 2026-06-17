import { useCallback, useEffect, useState } from "react";
import { showErrorToast } from "../../store/toast.store";
import { formatAdminApiError } from "../../utils/adminApiError";
import { adminService } from "../../services/admin.service";
import type { Category, Product, ProductStatus } from "../../types";
import { getPrimaryImage, getNormalizedVariants, getTotalStockSum } from "../../utils/product";
import { categoryPathLabel } from "../../utils/categoryTree";
import ProductEditModal from "../../components/admin/ProductEditModal";
import { AdminCategorySelect } from "../../components/admin/AdminCategorySelect";

type SortMode = "default" | "price-asc" | "price-desc";

const STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Активен",
  DRAFT: "Черновик",
  ARCHIVED: "В архиве",
};

/** Toolbar filter options — values must match backend ProductStatus + `all`. */
const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Все статусы" },
  { value: "ACTIVE", label: "Активные" },
  { value: "DRAFT", label: "Черновики" },
  { value: "ARCHIVED", label: "Архив" },
];

function sortToApi(sort: SortMode): string {
  if (sort === "price-asc") return "price_asc";
  if (sort === "price-desc") return "price_desc";
  return "newest";
}

export default function AdminProductManagePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [editId, setEditId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [quickSaving, setQuickSaving] = useState<number | null>(null);
  const [bulkCategoryPick, setBulkCategoryPick] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const categoryId =
        categoryFilter !== "" ? Number(categoryFilter) : undefined;
      const page = await adminService.getProductsPage({
        q: debouncedQuery || undefined,
        categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
        status: statusFilter,
        sort: sortToApi(sort),
        limit: 200,
        offset: 0,
      });
      setProducts(page.items);
      setTotal(page.total);
      const tree = await adminService.getCategories();
      setCategories(tree);
      setError(null);
    } catch (e) {
      setError(formatAdminApiError(e));
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, categoryFilter, statusFilter, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected =
    products.length > 0 && products.every((p) => p.id != null && selected.has(p.id));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(products.map((p) => p.id).filter((id): id is number => id != null)));
  }

  async function handleArchive(p: Product) {
    if (p.id == null) return;
    if (
      !window.confirm(
        `Отправить «${p.name}» в архив? Товар скроется с витрины, заказы сохранятся.`,
      )
    ) {
      return;
    }
    try {
      await adminService.archiveProduct(p.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(p.id!);
        return next;
      });
      setStatusFilter("ARCHIVED");
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function handleRestore(p: Product) {
    if (p.id == null) return;
    try {
      await adminService.restoreProduct(p.id);
      setStatusFilter("ACTIVE");
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function handleDuplicate(p: Product) {
    if (p.id == null) return;
    try {
      await adminService.duplicateProduct(p.id);
      await load();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function bulkAction(action: "archive" | "restore" | "active" | "draft") {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const status: ProductStatus =
        action === "archive"
          ? "ARCHIVED"
          : action === "restore" || action === "active"
            ? "ACTIVE"
            : "DRAFT";
      await adminService.bulkUpdateProducts({ ids, status });
      setSelected(new Set());
      if (action === "archive") setStatusFilter("ARCHIVED");
      else if (action === "restore" || action === "active") setStatusFilter("ACTIVE");
      else if (action === "draft") setStatusFilter("DRAFT");
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function bulkMoveCategory(categoryId: number) {
    const ids = [...selected];
    if (ids.length === 0 || !Number.isFinite(categoryId)) return;
    try {
      await adminService.bulkUpdateProducts({ ids, categoryId });
      setSelected(new Set());
      await load();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    }
  }

  async function quickSave(
    p: Product,
    patch: Partial<Pick<Product, "price" | "status" | "categoryId">> & { stock?: number },
  ) {
    if (p.id == null) return;
    setQuickSaving(p.id);
    try {
      const body: Parameters<typeof adminService.updateProduct>[1] = {};
      if (patch.price != null) body.price = patch.price;
      if (patch.status != null) body.status = patch.status;
      if (patch.categoryId != null) body.categoryId = patch.categoryId;
      if (patch.stock != null) {
        const variants = getNormalizedVariants(p);
        if (variants.length > 0) {
          body.variants = variants.map((v, i) =>
            i === 0
              ? {
                  ...v,
                  sizes: v.sizes.map((s, j) =>
                    j === 0 ? { ...s, stock: patch.stock! } : s,
                  ),
                }
              : v,
          );
        }
      }
      await adminService.updateProduct(p.id, body);
      await load();
    } catch (e) {
      showErrorToast(formatAdminApiError(e));
    } finally {
      setQuickSaving(null);
    }
  }

  return (
    <div className="admin-dash-page admin-pm-page">
      <header className="admin-dash-page__head">
        <div className="admin-pm-page__head-row">
          <div>
            <h1 className="admin-dash-page__title">Управление товарами</h1>
            <p className="admin-dash-page__subtitle">
              Каталог, редактирование, фото (Cloudinary), варианты и скидки.
            </p>
          </div>
          <a href="#/admin/products" className="admin-pm-back-link">
            ← Добавить товар
          </a>
        </div>
      </header>

      <div className="admin-pm-toolbar">
        <input
          type="search"
          className="admin-input admin-pm-search"
          placeholder="Поиск: название, описание, SKU, категория…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Поиск"
        />
        <AdminCategorySelect
          className="admin-select admin-pm-select"
          categories={categories}
          value={categoryFilter}
          placeholder="Все категории"
          aria-label="Категория"
          onChange={(id) => setCategoryFilter(id == null ? "" : String(id))}
        />
        <select
          className="admin-select admin-pm-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Статус"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="admin-select admin-pm-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Сортировка"
        >
          <option value="default">Сначала новые</option>
          <option value="price-asc">Цена ↑</option>
          <option value="price-desc">Цена ↓</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="admin-pm-bulk-bar">
          <span>Выбрано: {selected.size}</span>
          <button type="button" className="admin-pm-card__btn" onClick={() => void bulkAction("archive")}>
            В архив
          </button>
          <button type="button" className="admin-pm-card__btn" onClick={() => void bulkAction("restore")}>
            Восстановить
          </button>
          <button type="button" className="admin-pm-card__btn" onClick={() => void bulkAction("draft")}>
            Черновик
          </button>
          <button type="button" className="admin-pm-card__btn" onClick={() => void bulkAction("active")}>
            Активировать
          </button>
          <AdminCategorySelect
            className="admin-select admin-pm-select"
            categories={categories}
            value={bulkCategoryPick}
            placeholder="Перенести в категорию…"
            aria-label="Перенести в категорию"
            onChange={(id) => {
              if (id != null) void bulkMoveCategory(id);
              setBulkCategoryPick("");
            }}
          />
        </div>
      )}

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}

      {!loading && !error && products.length === 0 && (
        <p className="admin-dash-page__muted">Нет товаров по фильтру</p>
      )}

      {!loading && products.length > 0 && (
        <>
          <div className="admin-pm-list-head">
            <label className="admin-pm-select-all">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              <span>Выбрать все ({total})</span>
            </label>
          </div>
          <div className="admin-pm-grid">
            {products.map((p) => {
              const id = p.id;
              if (id == null) return null;
              const qty = getTotalStockSum(p);
              const cat = categoryPathLabel(p.categoryId ?? p.category?.id, categories);
              const st = p.status ?? "ACTIVE";
              const isArchived = st === "ARCHIVED";
              return (
                <article key={id} className="admin-pm-card">
                  <div className="admin-pm-card__top-row">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggleSelect(id)}
                      aria-label={`Выбрать ${p.name}`}
                    />
                    {st !== "ACTIVE" && (
                      <span className={`admin-pm-status admin-pm-status--${st.toLowerCase()}`}>
                        {STATUS_LABELS[st]}
                      </span>
                    )}
                  </div>
                  <div className="admin-pm-card__img-wrap">
                    <img src={getPrimaryImage(p)} alt="" />
                  </div>
                  <div className="admin-pm-card__body">
                    <h2 className="admin-pm-card__title">{p.name}</h2>
                    <div className="admin-pm-quick">
                      <label className="admin-pm-quick__field">
                        <span>Цена</span>
                        <input
                          type="number"
                          className="admin-input"
                          defaultValue={p.price}
                          disabled={quickSaving === id}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v !== p.price) {
                              void quickSave(p, { price: v });
                            }
                          }}
                        />
                      </label>
                      <label className="admin-pm-quick__field">
                        <span>Остаток</span>
                        <input
                          type="number"
                          className="admin-input"
                          defaultValue={qty}
                          disabled={quickSaving === id}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v !== qty) {
                              void quickSave(p, { stock: Math.max(0, Math.round(v)) });
                            }
                          }}
                        />
                      </label>
                      <label className="admin-pm-quick__field">
                        <span>Статус</span>
                        <select
                          className="admin-select"
                          value={st}
                          disabled={quickSaving === id}
                          onChange={(e) => {
                            void quickSave(p, {
                              status: e.target.value as ProductStatus,
                            });
                          }}
                        >
                          <option value="ACTIVE">Активен</option>
                          <option value="DRAFT">Черновик</option>
                          <option value="ARCHIVED">Архив</option>
                        </select>
                      </label>
                      <label className="admin-pm-quick__field">
                        <span>Категория</span>
                        <AdminCategorySelect
                          className="admin-select"
                          categories={categories}
                          value={p.categoryId ?? p.category?.id ?? ""}
                          disabled={quickSaving === id}
                          aria-label="Категория товара"
                          onChange={(categoryId) => {
                            if (categoryId != null) void quickSave(p, { categoryId });
                          }}
                        />
                      </label>
                    </div>
                    <p className="admin-pm-card__meta">
                      {p.discountPercent != null && p.discountPercent > 0 && (
                        <span className="admin-pm-card__disc">−{p.discountPercent}%</span>
                      )}
                    </p>
                    <dl className="admin-pm-card__dl">
                      <div>
                        <dt>Категория</dt>
                        <dd>{cat}</dd>
                      </div>
                    </dl>
                    <div className="admin-pm-card__actions">
                      <button
                        type="button"
                        className="admin-pm-card__btn admin-pm-card__btn--edit"
                        onClick={() => setEditId(id)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="admin-pm-card__btn"
                        onClick={() => void handleDuplicate(p)}
                      >
                        Дублировать
                      </button>
                      {isArchived ? (
                        <button
                          type="button"
                          className="admin-pm-card__btn"
                          onClick={() => void handleRestore(p)}
                        >
                          Восстановить
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-pm-card__btn admin-pm-card__btn--del"
                          onClick={() => void handleArchive(p)}
                        >
                          В архив
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ProductEditModal
        open={editId != null}
        productId={editId}
        onClose={() => setEditId(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
