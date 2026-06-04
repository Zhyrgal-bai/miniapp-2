import type { ReactElement } from "react";
import {
  DEFAULT_DISTANCE_TIERS,
  deliveryPricingModeLabelRu,
  type MerchantDeliveryPricingMode,
  type MerchantDeliverySettings,
  type MerchantDistanceTier,
} from "@repo-shared/merchantDeliverySettings";

const MODES: MerchantDeliveryPricingMode[] = [
  "SELF_PICKUP",
  "FIXED_PRICE",
  "DISTANCE_BASED",
  "FREE_DELIVERY",
  "MANUAL_CONFIRMATION",
];

const MIN_ORDER_PRESETS = [0, 500, 1000, 2000, 3000];

type Props = {
  value: MerchantDeliverySettings;
  onChange: (next: MerchantDeliverySettings) => void;
  disabled?: boolean;
};

function updateTier(
  tiers: MerchantDistanceTier[],
  index: number,
  patch: Partial<MerchantDistanceTier>,
): MerchantDistanceTier[] {
  return tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
}

export function MerchantDeliverySettingsPanel(props: Props): ReactElement {
  const v = props.value;
  const disabled = props.disabled ?? false;

  return (
    <div className="mp-delivery-settings">
      <div className="mp-settings-field">
        <label className="mp-settings-field__label" htmlFor="mp-delivery-mode">
          Режим доставки
        </label>
        <select
          id="mp-delivery-mode"
          className="mp-settings-field__input"
          disabled={disabled}
          value={v.pricingMode}
          onChange={(e) =>
            props.onChange({
              ...v,
              pricingMode: e.target.value as MerchantDeliveryPricingMode,
              distanceTiers:
                e.target.value === "DISTANCE_BASED" && v.distanceTiers.length === 0
                  ? DEFAULT_DISTANCE_TIERS.map((t) => ({ ...t }))
                  : v.distanceTiers,
            })
          }
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {deliveryPricingModeLabelRu(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="mp-settings-field">
        <label className="mp-settings-field__label" htmlFor="mp-min-order">
          Минимальная сумма заказа (сом)
        </label>
        <input
          id="mp-min-order"
          type="number"
          min={0}
          step={50}
          disabled={disabled}
          value={v.minOrderAmountSom}
          onChange={(e) =>
            props.onChange({
              ...v,
              minOrderAmountSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
            })
          }
          list="mp-min-order-presets"
        />
        <datalist id="mp-min-order-presets">
          {MIN_ORDER_PRESETS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      {v.pricingMode === "FIXED_PRICE" ? (
        <div className="mp-settings-field">
          <label className="mp-settings-field__label" htmlFor="mp-fixed-price">
            Стоимость доставки (сом)
          </label>
          <input
            id="mp-fixed-price"
            type="number"
            min={1}
            step={10}
            disabled={disabled}
            value={v.fixedPriceSom}
            onChange={(e) =>
              props.onChange({
                ...v,
                fixedPriceSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
              })
            }
          />
        </div>
      ) : null}

      {v.pricingMode === "DISTANCE_BASED" ? (
        <div className="mp-delivery-settings__tiers">
          <p className="mp-settings-section__desc">Тарифы по расстоянию от магазина (км)</p>
          {v.distanceTiers.map((tier, idx) => (
            <div key={idx} className="mp-delivery-settings__tier-row">
              <label className="mp-settings-field__label">
                До (км)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  disabled={disabled || tier.maxKm == null}
                  placeholder={tier.maxKm == null ? "∞" : ""}
                  value={tier.maxKm ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    props.onChange({
                      ...v,
                      distanceTiers: updateTier(v.distanceTiers, idx, {
                        maxKm: raw === "" ? null : Math.max(0, Number(raw)),
                      }),
                    });
                  }}
                />
              </label>
              <label className="mp-settings-field__label">
                Цена (сом)
                <input
                  type="number"
                  min={0}
                  step={10}
                  disabled={disabled}
                  value={tier.priceSom}
                  onChange={(e) =>
                    props.onChange({
                      ...v,
                      distanceTiers: updateTier(v.distanceTiers, idx, {
                        priceSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
                      }),
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      {v.pricingMode === "MANUAL_CONFIRMATION" ? (
        <p className="mp-settings-section__desc">
          На checkout покупатель увидит: «Стоимость доставки будет сообщена после
          подтверждения заказа».
        </p>
      ) : null}
    </div>
  );
}
