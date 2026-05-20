import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminAnalytics,
  MerchantGrowthDashboard,
} from "../../services/admin.service";
import { adminService } from "../../services/admin.service";
import { ru } from "../../i18n/ru";
import { mapStatus, ORDER_STATUS_RU } from "../../i18n/statusMaps";
import "./adminOperations.css";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новые",
  ACCEPTED: "Приняты",
  PAID_PENDING: "Ожидают оплату",
  CONFIRMED: "Оплачены",
  SHIPPED: "Отправлены",
  DELIVERED: "Доставлены",
  CANCELLED: "Отменены",
};

type Range = 7 | 30 | 90;
type Tab = "overview" | "audience" | "orders" | "support" | "growth";

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v}%`;
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [dashboard, setDashboard] = useState<MerchantGrowthDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, dash] = await Promise.all([
        adminService.getAnalytics(range),
        adminService.getGrowthDashboard(range),
      ]);
      setData(a);
      setDashboard(dash);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить аналитику");
      setData(null);
      setDashboard(null);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onOrdersChanged = () => void load();
    window.addEventListener("miniapp:admin-orders-changed", onOrdersChanged);
    return () =>
      window.removeEventListener(
        "miniapp:admin-orders-changed",
        onOrdersChanged,
      );
  }, [load]);

  const revenueChart = useMemo(() => {
    const series = data?.dailySeries ?? [];
    if (series.length === 0) return null;
    const maxRev = Math.max(1, ...series.map((d) => d.revenue));
    return series.map((d) => ({
      day: d.day.slice(5),
      hPct: Math.round((d.revenue / maxRev) * 100),
      revenue: d.revenue,
      orders: d.orders,
    }));
  }, [data?.dailySeries]);

  const ordersChart = useMemo(() => {
    const series = data?.dailySeries ?? [];
    if (series.length === 0) return null;
    const maxOrd = Math.max(1, ...series.map((d) => d.orders));
    return series.map((d) => ({
      day: d.day.slice(5),
      hPct: Math.round((d.orders / maxOrd) * 100),
      orders: d.orders,
    }));
  }, [data?.dailySeries]);

  return (
    <div className="admin-dash-page admin-ops-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Операции</h1>
        <p className="admin-dash-page__subtitle">
          Аналитика магазина за выбранный период — компактно для Telegram.
        </p>
      </header>

      <div className="admin-ops-tabs" role="tablist" aria-label="Разделы аналитики">
        {(
          [
            ["overview", "Обзор"],
            ["audience", "Аудитория"],
            ["orders", "Заказы"],
            ["support", "Поддержка"],
            ["growth", "Рост"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`admin-ops-tabs__btn${tab === id ? " admin-ops-tabs__btn--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

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

      {!data && !error && (
        <p className="admin-dash-page__muted">{ru.common.loading}</p>
      )}

      {data && tab === "overview" && (
        <>
          <div className="admin-ops-kpi-scroll">
            <div className="admin-kpi-card admin-ops-kpi-card">
              <span className="admin-kpi-card__label">{ru.admin.rangeRevenue}</span>
              <span className="admin-kpi-card__value">{data.revenueInRange ?? 0} сом</span>
            </div>
            <div className="admin-kpi-card admin-ops-kpi-card">
              <span className="admin-kpi-card__label">{ru.admin.rangeOrders}</span>
              <span className="admin-kpi-card__value">{data.ordersInRange ?? 0}</span>
            </div>
            <div className="admin-kpi-card admin-ops-kpi-card">
              <span className="admin-kpi-card__label">Средний чек</span>
              <span className="admin-kpi-card__value">{data.averageOrderValue ?? 0} сом</span>
            </div>
            <div className="admin-kpi-card admin-ops-kpi-card">
              <span className="admin-kpi-card__label">Конверсия</span>
              <span className="admin-kpi-card__value">{fmtPct(data.conversionRate)}</span>
            </div>
          </div>

          {revenueChart && revenueChart.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">Выручка по дням</h2>
              <div className="admin-analytics-chart admin-ops-chart" aria-hidden>
                {revenueChart.map((b) => (
                  <div key={b.day} className="admin-analytics-chart__bar-wrap">
                    <div
                      className="admin-analytics-chart__bar admin-ops-chart__bar--revenue"
                      style={{ height: `${Math.max(6, b.hPct)}%` }}
                      title={`${b.day}: ${b.revenue} сом`}
                    />
                    <span className="admin-analytics-chart__label">{b.day}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {ordersChart && ordersChart.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">Заказы по дням</h2>
              <div className="admin-analytics-chart admin-ops-chart" aria-hidden>
                {ordersChart.map((b) => (
                  <div key={`o-${b.day}`} className="admin-analytics-chart__bar-wrap">
                    <div
                      className="admin-analytics-chart__bar admin-ops-chart__bar--orders"
                      style={{ height: `${Math.max(6, b.hPct)}%` }}
                      title={`${b.day}: ${b.orders}`}
                    />
                    <span className="admin-analytics-chart__label">{b.day}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {data && tab === "audience" && (
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Уникальные посетители</span>
            <span className="admin-kpi-card__value">{data.uniqueVisitorsInRange ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Просмотры витрины</span>
            <span className="admin-kpi-card__value">{data.visitorsInRange ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">DAU (24ч)</span>
            <span className="admin-kpi-card__value">{data.dau ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">WAU (7д)</span>
            <span className="admin-kpi-card__value">{data.wau ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Повторные покупатели</span>
            <span className="admin-kpi-card__value">{data.repeatCustomers ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Конверсия в заказ</span>
            <span className="admin-kpi-card__value">{fmtPct(data.conversionRate)}</span>
          </div>
          <p className="admin-dash-page__muted admin-ops-hint">
            Посещаемость считается по открытиям витрины в Mini App. Данные накапливаются после
            обновления приложения.
          </p>
        </div>
      )}

      {data && tab === "orders" && (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Всего заказов</span>
              <span className="admin-kpi-card__value">{data.totalOrders}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{ru.admin.revenueLabel}</span>
              <span className="admin-kpi-card__value">{data.totalRevenue} сом</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{ru.admin.kpiPendingPayment}</span>
              <span className="admin-kpi-card__value">{data.pending ?? 0}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">В пути / доставлено</span>
              <span className="admin-kpi-card__value">{data.done}</span>
            </div>
          </div>

          {data.topSku && data.topSku.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">{ru.admin.topProducts}</h2>
              <div className="admin-analytics-top">
                {data.topSku.map((row, i) => (
                  <div key={`${row.productId ?? i}-${row.name}`} className="admin-analytics-top__row">
                    <span>{row.name}</span>
                    <strong>
                      {row.quantity} шт.
                      {typeof row.revenue === "number" && row.revenue > 0
                        ? ` · ${row.revenue} сом`
                        : ""}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">По статусам</h2>
            <div className="admin-status-grid">
              {Object.entries(data.byStatus ?? {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, count]) => (
                  <div key={status} className="admin-status-chip">
                    <span className="admin-status-chip__name">
                      {STATUS_LABELS[status] ??
                        mapStatus(status, ORDER_STATUS_RU)}
                    </span>
                    <span className="admin-status-chip__count">{count}</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {data && tab === "support" && (
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Открытые обращения</span>
            <span className="admin-kpi-card__value">{data.support?.openTickets ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Ждут ответа магазина</span>
            <span className="admin-kpi-card__value">{data.support?.pendingMerchant ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Закрыто за период</span>
            <span className="admin-kpi-card__value">{data.support?.resolvedInRange ?? 0}</span>
          </div>
          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">Активные возвраты</span>
            <span className="admin-kpi-card__value">{data.support?.openReturns ?? 0}</span>
          </div>
          <a href="#/admin/support" className="admin-ops-link-btn">
            Открыть поддержку →
          </a>
        </div>
      )}

      {tab === "growth" && dashboard && (
        <>
          <section className="admin-dash-section admin-ops-growth">
            <h2 className="admin-dash-section__title">{ru.admin.growthDashboard}</h2>
            <div className="admin-ops-growth__score">
              <span className="admin-ops-growth__value">{dashboard.growth.score}</span>
              <span className="admin-ops-growth__max">/ {dashboard.growth.maxScore}</span>
            </div>
            <p className="admin-dash-page__muted">
              Статус:{" "}
              {dashboard.retention.status === "active"
                ? "активен"
                : dashboard.retention.status === "at_risk"
                  ? "нужно внимание"
                  : "неактивен"}
            </p>
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">Заказов за период</span>
                <span className="admin-kpi-card__value">
                  {dashboard.engagement.ordersInRange}
                </span>
              </div>
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">Выручка</span>
                <span className="admin-kpi-card__value">
                  {dashboard.engagement.revenueInRange} сом
                </span>
              </div>
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">Конверсия</span>
                <span className="admin-kpi-card__value">
                  {fmtPct(dashboard.engagement.conversionRate)}
                </span>
              </div>
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">Рефералы</span>
                <span className="admin-kpi-card__value">
                  {dashboard.referral.signups}
                </span>
              </div>
            </div>
          </section>

          {dashboard.optimizationTips.length > 0 && (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">Рекомендации</h2>
              <ul className="admin-ops-growth__recs">
                {dashboard.optimizationTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">{ru.admin.milestones}</h2>
            <div className="admin-ops-growth__checklist">
              {dashboard.milestones.map((m) => (
                <div
                  key={m.id}
                  className={`admin-ops-growth__item${m.done ? " admin-ops-growth__item--done" : ""}`}
                >
                  <span>{m.done ? "✓" : "○"}</span>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">Инсайты</h2>
            <div className="admin-ops-insights">
              {dashboard.insights.insights.map((ins) => (
                <article
                  key={ins.code}
                  className={`admin-ops-insight admin-ops-insight--${ins.severity}`}
                >
                  <h3 className="admin-ops-insight__title">{ins.title}</h3>
                  <p className="admin-ops-insight__body">{ins.body}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
