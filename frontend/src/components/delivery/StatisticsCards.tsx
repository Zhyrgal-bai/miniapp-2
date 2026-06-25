import { memo } from "react";
import type {
  DeliveryAdminMode,
  MerchantDeliveryDashboard,
  OperatorDeliveryDashboard,
} from "../../types/deliveryAdmin.types";
import { formatSom } from "./deliveryUtils";

type StatisticsCardsProps = {
  mode: DeliveryAdminMode;
  merchant?: MerchantDeliveryDashboard | null;
  operator?: OperatorDeliveryDashboard | null;
  loading?: boolean;
};

type StatItem = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  delay: number;
};

function buildMerchantStats(d: MerchantDeliveryDashboard): StatItem[] {
  const todayTotal = d.completedToday + d.cancelledToday + d.failedToday;
  return [
    { key: "today", label: "Сегодня", value: String(todayTotal), sub: "доставок", delay: 0 },
    { key: "active", label: "Активные", value: String(d.active), delay: 40 },
    { key: "searching", label: "Поиск курьера", value: String(d.searching), delay: 80 },
    { key: "delivering", label: "В пути", value: String(d.delivering), delay: 120 },
    { key: "completed", label: "Завершено", value: String(d.completedToday), sub: "сегодня", delay: 160 },
    {
      key: "recovery",
      label: "Recovery",
      value: String(d.failedToday),
      sub: "проблемы сегодня",
      delay: 200,
    },
    {
      key: "eta",
      label: "Средний ETA",
      value: d.averageEtaMinutes != null ? `${d.averageEtaMinutes} мин` : "—",
      delay: 240,
    },
    {
      key: "price",
      label: "Средняя стоимость",
      value: formatSom(d.averageDeliveryPrice),
      delay: 280,
    },
  ];
}

function buildOperatorStats(d: OperatorDeliveryDashboard): StatItem[] {
  return [
    { key: "active", label: "Активные", value: String(d.activeDeliveries), delay: 0 },
    { key: "recovery", label: "Recovery", value: String(d.recoveryQueue), delay: 40 },
    { key: "failed", label: "Сбои", value: String(d.failedDeliveries), delay: 80 },
    {
      key: "completion",
      label: "Завершение",
      value: `${d.completionPercent}%`,
      delay: 120,
    },
    {
      key: "recoveryPct",
      label: "Recovery %",
      value: `${d.recoveryPercent}%`,
      delay: 160,
    },
    {
      key: "eta",
      label: "Средний ETA",
      value: d.averageEtaMinutes != null ? `${d.averageEtaMinutes} мин` : "—",
      delay: 200,
    },
    {
      key: "duration",
      label: "Длительность",
      value:
        d.averageDeliveryDurationMinutes != null
          ? `${d.averageDeliveryDurationMinutes} мин`
          : "—",
      delay: 240,
    },
    {
      key: "assignment",
      label: "Назначение курьера",
      value:
        d.averageCourierAssignmentMinutes != null
          ? `${d.averageCourierAssignmentMinutes} мин`
          : "—",
      delay: 280,
    },
  ];
}

export const StatisticsCards = memo(function StatisticsCards({
  mode,
  merchant,
  operator,
  loading = false,
}: StatisticsCardsProps) {
  if (loading) {
    return (
      <div className="dlv-stats" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="dlv-skeleton dlv-skeleton--stat" />
        ))}
      </div>
    );
  }

  const stats =
    mode === "operator" && operator
      ? buildOperatorStats(operator)
      : merchant
        ? buildMerchantStats(merchant)
        : [];

  if (stats.length === 0) return null;

  return (
    <div className="dlv-stats" aria-label="Статистика доставок">
      {stats.map((s) => (
        <article
          key={s.key}
          className="dlv-stat-card"
          style={{ animationDelay: `${s.delay}ms` }}
        >
          <div className="dlv-stat-card__label">{s.label}</div>
          <div className="dlv-stat-card__value">{s.value}</div>
          {s.sub ? <div className="dlv-stat-card__sub">{s.sub}</div> : null}
        </article>
      ))}
    </div>
  );
});
