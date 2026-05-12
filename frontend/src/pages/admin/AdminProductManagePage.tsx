import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import type { Category, Product } from "../../types";
import { getPrimaryImage, getTotalStockSum } from "../../utils/product";
import { categoryRoots } from "../../utils/categoryTree";
import ProductEditModal from "../../components/admin/ProductEditModal";

type SortMode = "default" | "price-asc" | "price-desc";

export default function AdminProductManagePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("default");
  const [editId, setEditId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getProducts();
      setProducts(data);
      const tree = await adminService.getCategories();
      setCategories(tree);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rootCategories = useMemo(() => categoryRoots(categories), [categories]);

  const filtered = useMemo(() => {
    let rows = [...products];
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      rows = rows.filter(
        (p) =>
          (p.category?.parent?.name ?? p.category?.name ?? "").trim() ===
          categoryFilter
      );
    }
    if (sort === "price-asc") {
      rows.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      rows.sort((a, b) => b.price - a.price);
    } else {
      rows.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    }
    return rows;
  }, [products, query, categoryFilter, sort]);

  async function handleDelete(p: Product) {
    if (p.id == null) return;
    if (
      !window.confirm(
        `Удалить товар «${p.name}»? Действие необратимо.`
      )
    ) {
      return;
    }
    try {
      await adminService.deleteProduct(p.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
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
          placeholder="Поиск по названию…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Поиск"
        />
        <select
          className="admin-select admin-pm-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {rootCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
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

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="admin-dash-page__muted">Нет товаров по фильтру</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="admin-pm-grid">
          {filtered.map((p) => {
            const id = p.id;
            if (id == null) return null;
            const qty = getTotalStockSum(p);
            const cat = p.category?.name ?? "—";
            const parentCat = p.category?.parent?.name;
            return (
              <article key={id} className="admin-pm-card">
                <div className="admin-pm-card__img-wrap">
                  <img src={getPrimaryImage(p)} alt="" />
                </div>
                <div className="admin-pm-card__body">
                  <h2 className="admin-pm-card__title">{p.name}</h2>
                  <p className="admin-pm-card__meta">
                    <span>{p.price} сом</span>
                    {p.discountPercent != null && p.discountPercent > 0 && (
                      <span className="admin-pm-card__disc">
                        −{p.discountPercent}%
                      </span>
                    )}
                  </p>
                  <dl className="admin-pm-card__dl">
                    <div>
                      <dt>Категория</dt>
                      <dd>{parentCat ? `${parentCat} / ${cat}` : cat}</dd>
                    </div>
                    <div>
                      <dt>В наличии</dt>
                      <dd>{qty} шт.</dd>
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
                      className="admin-pm-card__btn admin-pm-card__btn--del"
                      onClick={() => void handleDelete(p)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
