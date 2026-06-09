import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CustomerSegment,
  MerchantCustomerDashboard,
  MerchantCustomerDetail,
  MerchantCustomerRow,
} from "../../services/admin.service";
import { adminService } from "../../services/admin.service";
import { formatAdminApiError } from "../../utils/adminApiError";
import { ru } from "../../i18n/ru";
import { mapStatus, ORDER_STATUS_RU } from "../../i18n/statusMaps";
import {
  CUSTOMER_SEGMENT_FILTERS,
  customerInitials,
  formatCustomerLastOrder,
  formatLifetimeValue,
  resolveCustomerBadges,
} from "../../utils/customerCrm";
import "./adminOperations.css";
import "./adminCustomers.css";

type Range = 7 | 30 | 90;

export default function AdminCustomersPage() {
  const crm = ru.admin.crm;
  const [range, setRange] = useState<Range>(30);
  const [dashboard, setDashboard] = useState<MerchantCustomerDashboard | null>(null);
  const [customers, setCustomers] = useState<MerchantCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<CustomerSegment | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<MerchantCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await adminService.getCustomerDashboard(range);
      setDashboard(d);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(formatAdminApiError(e));
    }
  }, [range]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminService.getCustomers({
        search,
        segment,
        limit: 100,
      });
      setCustomers(d.customers);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [search, segment]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadList(), 250);
    return () => window.clearTimeout(id);
  }, [loadList]);

  const openDetail = useCallback(async (key: string) => {
    setActiveKey(key);
    setDetail(null);
    try {
      const d = await adminService.getCustomerDetail(key);
      setDetail(d);
    } catch (e) {
      console.error(e);
      setError(formatAdminApiError(e));
    }
  }, []);

  const kpis = useMemo(() => {
    if (dashboard == null) return null;
    return [
      { label: crm.totalCustomers, value: String(dashboard.totalCustomers) },
      { label: crm.newCustomers, value: String(dashboard.newCustomers) },
      { label: crm.returningCustomers, value: String(dashboard.returningCustomers) },
      { label: crm.repeatRate, value: `${dashboard.repeatPurchaseRate}%` },
      { label: crm.avgOrders, value: String(dashboard.averageOrdersPerCustomer) },
      { label: crm.avgLifetime, value: formatLifetimeValue(dashboard.averageLifetimeValue) },
    ];
  }, [dashboard, crm]);

  if (activeKey != null) {
    return (
      <div className="admin-dash-page admin-ops-page">
        <button
          type="button"
          className="admin-crm-back"
          onClick={() => {
            setActiveKey(null);
            setDetail(null);
          }}
        >
          {crm.backToList}
        </button>
        {detail == null ? (
          <p className="admin-dash-page__muted">{ru.common.loading}</p>
        ) : (
          <CustomerDetailView detail={detail} crm={crm} />
        )}
      </div>
    );
  }

  return (
    <div className="admin-dash-page admin-ops-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">{crm.title}</h1>
        <p className="admin-dash-page__subtitle">{crm.subtitle}</p>
      </header>

      <div className="admin-analytics-range" role="tablist" aria-label="Период">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={range === d}
            className={`admin-analytics-range__btn${range === d ? " admin-analytics-range__btn--active" : ""}`}
            onClick={() => setRange(d)}
          >
            {d === 7 ? ru.admin.period7 : d === 30 ? ru.admin.period30 : ru.admin.period90}
          </button>
        ))}
      </div>

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {kpis && (
        <div className="admin-kpi-grid">
          {kpis.map((k) => (
            <div key={k.label} className="admin-kpi-card">
              <span className="admin-kpi-card__label">{k.label}</span>
              <span className="admin-kpi-card__value">{k.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-crm-controls">
        <input
          type="search"
          className="admin-crm-search"
          placeholder={crm.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-crm-filters" role="tablist" aria-label="Сегменты">
          <button
            type="button"
            className={`admin-crm-chip${segment == null ? " admin-crm-chip--active" : ""}`}
            onClick={() => setSegment(null)}
          >
            Все
          </button>
          {CUSTOMER_SEGMENT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`admin-crm-chip${segment === f.id ? " admin-crm-chip--active" : ""}`}
              onClick={() => setSegment((cur) => (cur === f.id ? null : f.id))}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && customers.length === 0 ? (
        <p className="admin-dash-page__muted">{ru.common.loading}</p>
      ) : customers.length === 0 ? (
        <p className="admin-dash-page__muted">{crm.emptyList}</p>
      ) : (
        <div className="admin-crm-list">
          {customers.map((c) => (
            <button
              key={c.customerKey}
              type="button"
              className="admin-crm-card"
              onClick={() => void openDetail(c.customerKey)}
            >
              <span className="admin-crm-card__avatar" aria-hidden>
                {customerInitials(c.name)}
              </span>
              <span className="admin-crm-card__main">
                <span className="admin-crm-card__name">{c.name}</span>
                {c.phone ? <span className="admin-crm-card__phone">{c.phone}</span> : null}
                <span className="admin-crm-card__badges">
                  {resolveCustomerBadges(c.segments).map((b) => (
                    <span
                      key={b.segment}
                      className={`admin-crm-badge admin-crm-badge--${b.tone}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </span>
              </span>
              <span className="admin-crm-card__stats">
                <span className="admin-crm-card__value">{formatLifetimeValue(c.lifetimeValue)}</span>
                <span className="admin-crm-card__meta">
                  {c.ordersCount} {crm.ordersCount.toLowerCase()} · {formatCustomerLastOrder(c.daysSinceLastOrder)}
                </span>
              </span>
            </button>
          ))}
          <p className="admin-dash-page__muted admin-crm-total">
            {crm.totalCustomers}: {total}
          </p>
        </div>
      )}
    </div>
  );
}

function CustomerDetailView({
  detail,
  crm,
}: {
  detail: MerchantCustomerDetail;
  crm: typeof ru.admin.crm;
}) {
  const c = detail.customer;
  return (
    <>
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">{c?.name ?? "Клиент"}</h1>
        {c?.phone ? (
          <p className="admin-dash-page__subtitle">{c.phone}</p>
        ) : null}
      </header>

      {c ? (
        <>
          <div className="admin-crm-card__badges admin-crm-detail-badges">
            {resolveCustomerBadges(c.segments).map((b) => (
              <span key={b.segment} className={`admin-crm-badge admin-crm-badge--${b.tone}`}>
                {b.label}
              </span>
            ))}
          </div>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{crm.lifetimeValue}</span>
              <span className="admin-kpi-card__value">{formatLifetimeValue(c.lifetimeValue)}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{crm.ordersCount}</span>
              <span className="admin-kpi-card__value">{c.ordersCount}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{crm.lastOrder}</span>
              <span className="admin-kpi-card__value">
                {formatCustomerLastOrder(c.daysSinceLastOrder)}
              </span>
            </div>
          </div>
        </>
      ) : null}

      {detail.preferences.length > 0 ? (
        <section className="admin-dash-section">
          <h2 className="admin-dash-section__title">{crm.preferences}</h2>
          <div className="admin-crm-prefs">
            {detail.preferences.map((p) => (
              <span key={p.key} className="admin-crm-pref">
                {p.label}: <strong>{p.valueLabel}</strong>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {detail.favoriteProducts.length > 0 ? (
        <section className="admin-dash-section">
          <h2 className="admin-dash-section__title">{crm.favoriteProducts}</h2>
          <div className="admin-analytics-top">
            {detail.favoriteProducts.map((p, i) => (
              <div key={`${p.productId ?? i}-${p.name}`} className="admin-analytics-top__row">
                <span>{p.name}</span>
                <strong>{p.quantity} шт.</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {detail.favoriteCategories.length > 0 ? (
        <section className="admin-dash-section">
          <h2 className="admin-dash-section__title">{crm.favoriteCategories}</h2>
          <div className="admin-analytics-top">
            {detail.favoriteCategories.map((p, i) => (
              <div key={`${p.categoryId ?? i}-${p.name}`} className="admin-analytics-top__row">
                <span>{p.name}</span>
                <strong>{p.quantity} шт.</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {detail.recentAddresses.length > 0 ? (
        <section className="admin-dash-section">
          <h2 className="admin-dash-section__title">{crm.recentAddresses}</h2>
          <ul className="admin-crm-addresses">
            {detail.recentAddresses.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-dash-section">
        <h2 className="admin-dash-section__title">{crm.orderHistory}</h2>
        <div className="admin-crm-orders">
          {detail.orders.map((o) => (
            <div key={o.id} className="admin-crm-order">
              <div className="admin-crm-order__head">
                <span className="admin-crm-order__num">
                  {o.orderNumber ?? `#${o.id}`}
                </span>
                <span className="admin-crm-order__status">
                  {mapStatus(o.status, ORDER_STATUS_RU)}
                </span>
                <span className="admin-crm-order__total">{o.total} сом</span>
              </div>
              {o.summary ? (
                <p className="admin-crm-order__summary">{o.summary}</p>
              ) : null}
              <span className="admin-crm-order__date">
                {o.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
