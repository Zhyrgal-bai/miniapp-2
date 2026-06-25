import { memo, useEffect, useMemo, useState } from "react";
import type {
  DeliveryProviderPublic,
  MerchantDeliveryProviderPolicy,
} from "../../types/deliveryAdmin.types";
import { ProviderBadge } from "./ProviderBadge";
import { STRATEGY_LABELS } from "./deliveryUtils";

type DeliveryProviderSettingsProps = {
  policy: MerchantDeliveryProviderPolicy | null;
  providers: DeliveryProviderPublic[];
  loading?: boolean;
  saving?: boolean;
  onSave: (patch: Partial<MerchantDeliveryProviderPolicy>) => Promise<void>;
};

export const DeliveryProviderSettings = memo(function DeliveryProviderSettings({
  policy,
  providers,
  loading = false,
  saving = false,
  onSave,
}: DeliveryProviderSettingsProps) {
  const [draft, setDraft] = useState<MerchantDeliveryProviderPolicy | null>(policy);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(policy);
  }, [policy]);

  const validation = useMemo(() => {
    const next: Record<string, string> = {};
    if (!draft) return next;
    if (draft.maxPriceSom != null && draft.maxPriceSom < 0) {
      next.maxPriceSom = "Цена не может быть отрицательной";
    }
    if (draft.maxEtaMinutes != null && draft.maxEtaMinutes < 5) {
      next.maxEtaMinutes = "Минимум 5 минут";
    }
    if (draft.preferredProviders.length === 0) {
      next.preferredProviders = "Выберите хотя бы одного провайдера";
    }
    return next;
  }, [draft]);

  useEffect(() => {
    setErrors(validation);
  }, [validation]);

  if (loading || !draft) {
    return <div className="dlv-skeleton" style={{ height: 280 }} aria-hidden />;
  }

  const moveProvider = (idx: number, dir: -1 | 1) => {
    const list = [...draft.preferredProviders];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[target];
    list[target] = tmp;
    setDraft({ ...draft, preferredProviders: list });
  };

  const toggleProvider = (pid: string) => {
    const has = draft.preferredProviders.includes(pid);
    const list = has
      ? draft.preferredProviders.filter((p) => p !== pid)
      : [...draft.preferredProviders, pid];
    setDraft({
      ...draft,
      preferredProviders: list,
      preferredProvider: list[0] ?? null,
    });
  };

  const canSave = Object.keys(errors).length === 0 && !saving;

  return (
    <div className="dlv-settings-form">
      <div className="dlv-field">
        <label>
          <input
            type="checkbox"
            checked={draft.autoSelection}
            onChange={(e) =>
              setDraft({ ...draft, autoSelection: e.target.checked })
            }
          />{" "}
          Автовыбор провайдера
        </label>
      </div>

      <div className="dlv-field">
        <label htmlFor="dlv-strategy">Стратегия</label>
        <select
          id="dlv-strategy"
          value={draft.strategy}
          onChange={(e) =>
            setDraft({
              ...draft,
              strategy: e.target.value as MerchantDeliveryProviderPolicy["strategy"],
            })
          }
        >
          {Object.entries(STRATEGY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="dlv-field">
        <label htmlFor="dlv-max-price">Максимальная цена (сом)</label>
        <input
          id="dlv-max-price"
          type="number"
          min={0}
          value={draft.maxPriceSom ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              maxPriceSom: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="Без лимита"
        />
        {errors.maxPriceSom ? (
          <div className="dlv-field__error">{errors.maxPriceSom}</div>
        ) : null}
      </div>

      <div className="dlv-field">
        <label htmlFor="dlv-max-eta">Максимальный ETA (мин)</label>
        <input
          id="dlv-max-eta"
          type="number"
          min={5}
          value={draft.maxEtaMinutes ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              maxEtaMinutes: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="Без лимита"
        />
        {errors.maxEtaMinutes ? (
          <div className="dlv-field__error">{errors.maxEtaMinutes}</div>
        ) : null}
      </div>

      <div className="dlv-field">
        <label>
          <input
            type="checkbox"
            checked={draft.allowFallback}
            onChange={(e) =>
              setDraft({ ...draft, allowFallback: e.target.checked })
            }
          />{" "}
          Разрешить fallback
        </label>
      </div>

      <div className="dlv-field">
        <label>
          <input
            type="checkbox"
            checked={draft.allowAutoSwitch}
            onChange={(e) =>
              setDraft({ ...draft, allowAutoSwitch: e.target.checked })
            }
          />{" "}
          Автопереключение при сбое
        </label>
      </div>

      <div className="dlv-field">
        <span className="dlv-drawer-section__title">Приоритет провайдеров</span>
        <div className="dlv-provider-priority">
          {draft.preferredProviders.map((pid, idx) => (
            <div key={pid} className="dlv-provider-priority__row">
              <span>{idx + 1}</span>
              <ProviderBadge providerId={pid} />
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost dlv-btn--sm"
                onClick={() => moveProvider(idx, -1)}
                disabled={idx === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="dlv-btn dlv-btn--ghost dlv-btn--sm"
                onClick={() => moveProvider(idx, 1)}
                disabled={idx === draft.preferredProviders.length - 1}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
        {errors.preferredProviders ? (
          <div className="dlv-field__error">{errors.preferredProviders}</div>
        ) : null}
        <div className="dlv-filters" style={{ marginTop: 10 }}>
          {providers.map((p) => (
            <button
              key={p.providerId}
              type="button"
              className={`dlv-chip${draft.preferredProviders.includes(p.providerId) ? " dlv-chip--active" : ""}`}
              onClick={() => toggleProvider(p.providerId)}
            >
              {p.displayName}
              <span className="dlv-auto-refresh">
                {" "}
                · {p.health.state}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="dlv-btn dlv-btn--primary"
        disabled={!canSave}
        onClick={() => void onSave(draft)}
      >
        {saving ? "Сохранение…" : "Сохранить настройки"}
      </button>
    </div>
  );
});
