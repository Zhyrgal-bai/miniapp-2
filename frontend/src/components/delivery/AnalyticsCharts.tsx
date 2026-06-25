import { memo, useMemo } from "react";
import type {
  DeliveryAnalyticsReport,
  DeliveryAnalyticsPeriod,
  OperatorDeliveryDashboard,
} from "../../types/deliveryAdmin.types";
import { getProviderMeta } from "./deliveryUtils";

type AnalyticsChartsProps = {
  analytics: DeliveryAnalyticsReport | null;
  operatorDashboard?: OperatorDeliveryDashboard | null;
  period: DeliveryAnalyticsPeriod;
  onPeriodChange: (p: DeliveryAnalyticsPeriod) => void;
  loading?: boolean;
};

export const AnalyticsCharts = memo(function AnalyticsCharts({
  analytics,
  operatorDashboard,
  period,
  onPeriodChange,
  loading = false,
}: AnalyticsChartsProps) {
  const providerShare = useMemo(() => {
    if (!operatorDashboard?.deliveriesByProvider) return null;
    const entries = Object.entries(operatorDashboard.deliveriesByProvider);
    if (entries.length === 0) return null;
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries.map(([pid, count]) => ({
      pid,
      label: getProviderMeta(pid).shortLabel,
      count,
      hPct: Math.round((count / max) * 100),
    }));
  }, [operatorDashboard?.deliveriesByProvider]);

  const failureBars = useMemo(() => {
    if (!analytics?.failureReasons) return null;
    const entries = Object.entries(analytics.failureReasons);
    if (entries.length === 0) return null;
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries.slice(0, 8).map(([reason, count]) => ({
      reason: reason.length > 16 ? `${reason.slice(0, 14)}…` : reason,
      count,
      hPct: Math.round((count / max) * 100),
    }));
  }, [analytics?.failureReasons]);

  if (loading) {
    return <div className="dlv-skeleton" style={{ height: 240 }} aria-hidden />;
  }

  return (
    <div className="dlv-charts">
      <div className="dlv-chart-card">
        <div className="dlv-chart-card__title">Период</div>
        <div className="dlv-filters">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`dlv-chip${period === p ? " dlv-chip--active" : ""}`}
              onClick={() => onPeriodChange(p)}
            >
              {p === "daily" ? "День" : p === "weekly" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      {analytics ? (
        <div className="dlv-chart-card">
          <div className="dlv-chart-card__title">Ключевые метрики</div>
          <div className="dlv-drawer-grid">
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Средняя доставка</div>
              <div className="dlv-drawer-kv__v">
                {analytics.deliveryDurationMinutes.avg != null
                  ? `${analytics.deliveryDurationMinutes.avg} мин`
                  : "—"}
              </div>
            </div>
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Назначение курьера</div>
              <div className="dlv-drawer-kv__v">
                {analytics.courierAssignmentMinutes.avg != null
                  ? `${analytics.courierAssignmentMinutes.avg} мин`
                  : "—"}
              </div>
            </div>
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Recovery</div>
              <div className="dlv-drawer-kv__v">{analytics.recoveryCount}</div>
            </div>
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Повторы</div>
              <div className="dlv-drawer-kv__v">{analytics.retryCount}</div>
            </div>
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Webhook</div>
              <div className="dlv-drawer-kv__v">
                {analytics.providerLatency.webhookEvents}
              </div>
            </div>
            <div className="dlv-drawer-kv">
              <div className="dlv-drawer-kv__k">Обновления</div>
              <div className="dlv-drawer-kv__v">
                {analytics.providerLatency.refreshEvents}
              </div>
            </div>
          </div>
          {operatorDashboard ? (
            <div className="dlv-drawer-grid" style={{ marginTop: 12 }}>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Completion rate</div>
                <div className="dlv-drawer-kv__v">
                  {operatorDashboard.completionPercent}%
                </div>
              </div>
              <div className="dlv-drawer-kv">
                <div className="dlv-drawer-kv__k">Recovery %</div>
                <div className="dlv-drawer-kv__v">
                  {operatorDashboard.recoveryPercent}%
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {providerShare ? (
        <div className="dlv-chart-card">
          <div className="dlv-chart-card__title">Доля провайдеров</div>
          <div className="dlv-chart-bars" aria-hidden>
            {providerShare.map((d) => (
              <div key={d.pid} className="dlv-chart-bars__col">
                <div
                  className="dlv-chart-bars__bar"
                  style={{ height: `${d.hPct}%` }}
                  title={`${d.label}: ${d.count}`}
                />
                <span className="dlv-chart-bars__label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {failureBars ? (
        <div className="dlv-chart-card">
          <div className="dlv-chart-card__title">Причины сбоев</div>
          <div className="dlv-chart-bars" aria-hidden>
            {failureBars.map((d) => (
              <div key={d.reason} className="dlv-chart-bars__col">
                <div
                  className="dlv-chart-bars__bar"
                  style={{
                    height: `${d.hPct}%`,
                    background:
                      "linear-gradient(180deg, #f87171, #ef4444)",
                  }}
                  title={`${d.reason}: ${d.count}`}
                />
                <span className="dlv-chart-bars__label">{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});
