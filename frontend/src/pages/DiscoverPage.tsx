import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchDiscoverStores, type DiscoverStoreCard } from "../services/discoverApi";
import "./DiscoverPage.css";

const TYPE_LABELS: Record<string, string> = {
  clothing: "Одежда",
  coffee: "Кофе",
  fastfood: "Еда",
  flowers: "Цветы",
};

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DiscoverStoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDiscoverStores(
        filter ? { type: filter } : undefined,
      );
      setItems(data);
      setError(null);
    } catch {
      setError("Не удалось загрузить магазины");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="discover-page">
      <header className="discover-page__head">
        <button type="button" className="discover-page__back" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h1 className="discover-page__title">Маркетплейс</h1>
        <p className="discover-page__sub">Магазины в экосистеме платформы</p>
      </header>

      <div className="discover-page__filters" role="tablist">
        <button
          type="button"
          className={`discover-page__chip${filter === "" ? " discover-page__chip--active" : ""}`}
          onClick={() => setFilter("")}
        >
          Все
        </button>
        {Object.entries(TYPE_LABELS).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`discover-page__chip${filter === k ? " discover-page__chip--active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="discover-page__muted">Загрузка…</p>}
      {error && <p className="discover-page__error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="discover-page__muted">
          Пока нет публичных магазинов. Мерчанты могут включить видимость в кабинете.
        </p>
      )}

      <ul className="discover-page__list">
        {items.map((s) => (
          <li key={s.slug}>
            <Link to={s.openPath} className="discover-page__card">
              {s.logoUrl ? (
                <img src={s.logoUrl} alt="" className="discover-page__logo" />
              ) : (
                <div className="discover-page__logo discover-page__logo--ph" aria-hidden>
                  {s.displayName.slice(0, 1)}
                </div>
              )}
              <div className="discover-page__card-body">
                <span className="discover-page__name">{s.displayName}</span>
                {s.tagline ? (
                  <span className="discover-page__tagline">{s.tagline}</span>
                ) : null}
                <span className="discover-page__type">
                  {TYPE_LABELS[s.businessType] ?? s.businessType}
                  {s.featured ? " · ★" : ""}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
