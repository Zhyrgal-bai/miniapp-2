import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminAnalytics } from "../../services/admin.service";
import { adminService } from "../../services/admin.service";
import { ru } from "../../i18n/ru";

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

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const a = await adminService.getAnalytics(range);
      setData(a);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить аналитику");
      setData(null);
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

  const chart = useMemo(() => {
    const series = data?.dailySeries ?? [];
    if (series.length === 0) return null;
    const maxRev = Math.max(1, ...series.map((d) => d.revenue));
    return series.map((d) => ({
      day: d.day.slice(5),
      hPct: Math.round((d.revenue / maxRev) * 100),
      revenue: d.revenue,
    }));
  }, [data?.dailySeries]);

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Аналитика</h1>
        <p className="admin-dash-page__subtitle">{ru.admin.analyticsSubtitle}</p>
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

      {!data && !error && (
        <p className="admin-dash-page__muted">{ru.common.loading}</p>
      )}

      {data && (
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
              <span className="admin-kpi-card__label">{ru.admin.kpiAccepted}</span>
              <span className="admin-kpi-card__value">{data.accepted}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{ru.admin.kpiPendingPayment}</span>
              <span className="admin-kpi-card__value">{data.pending ?? 0}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">В пути / доставлено</span>
              <span className="admin-kpi-card__value">{data.done}</span>
            </div>
            {typeof data.shipped === "number" && (
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">{ru.admin.kpiShipped}</span>
                <span className="admin-kpi-card__value">{data.shipped}</span>
              </div>
            )}
            {typeof data.delivered === "number" && (
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">{ru.admin.kpiDelivered}</span>
                <span className="admin-kpi-card__value">{data.delivered}</span>
              </div>
            )}
            {typeof data.revenueInRange === "number" && (
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">{ru.admin.rangeRevenue}</span>
                <span className="admin-kpi-card__value">{data.revenueInRange} сом</span>
              </div>
            )}
            {typeof data.ordersInRange === "number" && (
              <div className="admin-kpi-card">
                <span className="admin-kpi-card__label">{ru.admin.rangeOrders}</span>
                <span className="admin-kpi-card__value">{data.ordersInRange}</span>
              </div>
            )}
          </div>

          {chart && chart.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">{ru.admin.chartHint}</h2>
              <div className="admin-analytics-chart" aria-hidden>
                {chart.map((b) => (
                  <div key={b.day} className="admin-analytics-chart__bar-wrap">
                    <div
                      className="admin-analytics-chart__bar"
                      style={{ height: `${Math.max(6, b.hPct)}%` }}
                      title={`${b.day}: ${b.revenue} сом`}
                    />
                    <span className="admin-analytics-chart__label">{b.day}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.topSku && data.topSku.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">{ru.admin.topProducts}</h2>
              <div className="admin-analytics-top">
                {data.topSku.map((row, i) => (
                  <div key={`${row.productId ?? i}-${row.name}`} className="admin-analytics-top__row">
                    <span>{row.name}</span>
                    <strong>{row.quantity}</strong>
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
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <span className="admin-status-chip__count">{count}</span>
                  </div>
                ))}
              {Object.keys(data.byStatus ?? {}).length === 0 && (
                <p className="admin-dash-page__muted">Нет данных по статусам</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
