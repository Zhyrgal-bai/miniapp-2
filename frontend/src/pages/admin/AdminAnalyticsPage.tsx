import { useCallback, useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новые",
  ACCEPTED: "Приняты",
  PAID_PENDING: "Ожидают оплату",
  CONFIRMED: "Оплачены",
  SHIPPED: "Отправлены",
  CANCELLED: "Отменены",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<{
    totalOrders: number;
    totalRevenue: number;
    accepted: number;
    pending: number;
    done: number;
    byStatus: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const a = await adminService.getAnalytics();
      setData({
        totalOrders: a.totalOrders,
        totalRevenue: a.totalRevenue,
        accepted: a.accepted,
        pending: a.pending ?? 0,
        done: a.done,
        byStatus: a.byStatus ?? {},
      });
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить аналитику");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onOrdersChanged = () => void load();
    window.addEventListener("miniapp:admin-orders-changed", onOrdersChanged);
    return () =>
      window.removeEventListener(
        "miniapp:admin-orders-changed",
        onOrdersChanged
      );
  }, [load]);

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Аналитика</h1>
        <p className="admin-dash-page__subtitle">
          По заказам в базе данных (Prisma). Выручка — сумма заказов в статусах
          CONFIRMED и SHIPPED.
        </p>
      </header>

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {!data && !error && (
        <p className="admin-dash-page__muted">Загрузка…</p>
      )}

      {data && (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Всего заказов</span>
              <span className="admin-kpi-card__value">{data.totalOrders}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Выручка (оплач. + отпр.)</span>
              <span className="admin-kpi-card__value">{data.totalRevenue} сом</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Принято (ACCEPTED)</span>
              <span className="admin-kpi-card__value">{data.accepted}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Ожидают подтверждения оплаты</span>
              <span className="admin-kpi-card__value">{data.pending}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">Отправлено</span>
              <span className="admin-kpi-card__value">{data.done}</span>
            </div>
          </div>

          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">По статусам</h2>
            <div className="admin-status-grid">
              {Object.entries(data.byStatus)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, count]) => (
                  <div key={status} className="admin-status-chip">
                    <span className="admin-status-chip__name">
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <span className="admin-status-chip__count">{count}</span>
                  </div>
                ))}
              {Object.keys(data.byStatus).length === 0 && (
                <p className="admin-dash-page__muted">Нет данных по статусам</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
