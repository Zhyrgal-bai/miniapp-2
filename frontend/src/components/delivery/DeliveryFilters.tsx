import { memo } from "react";
import type {
  DeliverySearchFilters,
  ProviderDeliveryStatus,
} from "../../types/deliveryAdmin.types";
import { getProviderMeta } from "./deliveryUtils";

const STATUS_OPTIONS: { value: ProviderDeliveryStatus | ""; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "SEARCHING_COURIER", label: "Поиск курьера" },
  { value: "COURIER_ASSIGNED", label: "Курьер назначен" },
  { value: "DELIVERING", label: "В пути" },
  { value: "DELIVERED", label: "Доставлено" },
  { value: "RECOVERY_REQUIRED", label: "Recovery" },
  { value: "FAILED", label: "Ошибка" },
  { value: "CANCELLED", label: "Отменено" },
];

const PROVIDER_IDS = ["", "yandex", "glovo", "namba", "own_courier", "dhl", "ups"];

type DeliveryFiltersProps = {
  filters: DeliverySearchFilters;
  onChange: (patch: Partial<DeliverySearchFilters>) => void;
  showMerchantFilter?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

export const DeliveryFilters = memo(function DeliveryFilters({
  filters,
  onChange,
  showMerchantFilter = false,
  expanded = false,
  onToggleExpanded,
}: DeliveryFiltersProps) {
  return (
    <>
      <div className="dlv-filters" role="group" aria-label="Быстрые фильтры">
        <button
          type="button"
          className={`dlv-chip${!filters.status && !filters.recoveryStatus ? " dlv-chip--active" : ""}`}
          onClick={() => onChange({ status: "", recoveryStatus: "" })}
        >
          Все
        </button>
        <button
          type="button"
          className={`dlv-chip${filters.status === "SEARCHING_COURIER" ? " dlv-chip--active" : ""}`}
          onClick={() =>
            onChange({ status: "SEARCHING_COURIER", recoveryStatus: "" })
          }
        >
          Поиск курьера
        </button>
        <button
          type="button"
          className={`dlv-chip${filters.status === "DELIVERING" ? " dlv-chip--active" : ""}`}
          onClick={() => onChange({ status: "DELIVERING", recoveryStatus: "" })}
        >
          В пути
        </button>
        <button
          type="button"
          className={`dlv-chip${filters.recoveryStatus === "recovery_required" ? " dlv-chip--active" : ""}`}
          onClick={() =>
            onChange({
              status: "",
              recoveryStatus:
                filters.recoveryStatus === "recovery_required"
                  ? ""
                  : "recovery_required",
            })
          }
        >
          Recovery
        </button>
        {PROVIDER_IDS.filter(Boolean).map((pid) => (
          <button
            key={pid}
            type="button"
            className={`dlv-chip${filters.provider === pid ? " dlv-chip--active" : ""}`}
            onClick={() =>
              onChange({ provider: filters.provider === pid ? "" : pid })
            }
          >
            {getProviderMeta(pid).shortLabel}
          </button>
        ))}
        {onToggleExpanded ? (
          <button type="button" className="dlv-chip" onClick={onToggleExpanded}>
            {expanded ? "Скрыть ▲" : "Ещё ▼"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="dlv-filter-panel">
          <div className="dlv-filter-panel__row">
            <div className="dlv-field">
              <label htmlFor="dlv-filter-status">Статус</label>
              <select
                id="dlv-filter-status"
                value={filters.status ?? ""}
                onChange={(e) =>
                  onChange({
                    status: e.target.value as ProviderDeliveryStatus | "",
                  })
                }
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="dlv-field">
              <label htmlFor="dlv-filter-provider">Провайдер</label>
              <select
                id="dlv-filter-provider"
                value={filters.provider ?? ""}
                onChange={(e) => onChange({ provider: e.target.value })}
              >
                <option value="">Все</option>
                {PROVIDER_IDS.filter(Boolean).map((pid) => (
                  <option key={pid} value={pid}>
                    {getProviderMeta(pid).label}
                  </option>
                ))}
              </select>
            </div>
            <div className="dlv-field">
              <label htmlFor="dlv-filter-recovery">Recovery</label>
              <select
                id="dlv-filter-recovery"
                value={filters.recoveryStatus ?? ""}
                onChange={(e) =>
                  onChange({
                    recoveryStatus: e.target.value as DeliverySearchFilters["recoveryStatus"],
                  })
                }
              >
                <option value="">Все</option>
                <option value="recovery_required">Требуется</option>
                <option value="recovering">В процессе</option>
                <option value="none">Без recovery</option>
              </select>
            </div>
            {showMerchantFilter ? (
              <div className="dlv-field">
                <label htmlFor="dlv-filter-merchant">Merchant ID</label>
                <input
                  id="dlv-filter-merchant"
                  type="text"
                  inputMode="numeric"
                  value={filters.merchantId ?? ""}
                  onChange={(e) => onChange({ merchantId: e.target.value })}
                  placeholder="ID магазина"
                />
              </div>
            ) : null}
            <div className="dlv-field">
              <label htmlFor="dlv-filter-from">Дата от</label>
              <input
                id="dlv-filter-from"
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => onChange({ dateFrom: e.target.value })}
              />
            </div>
            <div className="dlv-field">
              <label htmlFor="dlv-filter-to">Дата до</label>
              <input
                id="dlv-filter-to"
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => onChange({ dateTo: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});
