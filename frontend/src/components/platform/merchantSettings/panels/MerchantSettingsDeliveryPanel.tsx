import type { ReactElement } from "react";
import { archa } from "../../../archa/archaUi";
import {
  DEFAULT_DISTANCE_TIERS,
  deliveryPricingModeLabelRu,
  type MerchantDeliveryPricingMode,
  type MerchantDeliverySettings,
  type MerchantDistanceTier,
} from "@repo-shared/merchantDeliverySettings";
import type { StoreAvailabilitySettings } from "@repo-shared/storeAvailabilitySettings";

const MODES: MerchantDeliveryPricingMode[] = [
  "SELF_PICKUP",
  "FIXED_PRICE",
  "DISTANCE_BASED",
  "FREE_DELIVERY",
  "MANUAL_CONFIRMATION",
];

const MODE_HINTS: Record<MerchantDeliveryPricingMode, string> = {
  SELF_PICKUP: "Только самовывоз",
  FIXED_PRICE: "Фиксированная цена доставки",
  DISTANCE_BASED: "Тарифы по расстоянию",
  FREE_DELIVERY: "Бесплатная доставка",
  MANUAL_CONFIRMATION: "Цену уточняет магазин",
};

const MIN_ORDER_PRESETS = [0, 500, 1000, 2000, 3000];

type Props = {
  deliverySettings: MerchantDeliverySettings;
  onDeliverySettingsChange: (v: MerchantDeliverySettings) => void;
  availability: StoreAvailabilitySettings;
  onAvailabilityChange: (v: StoreAvailabilitySettings) => void;
  disabled?: boolean;
};

function updateTier(
  tiers: MerchantDistanceTier[],
  index: number,
  patch: Partial<MerchantDistanceTier>,
): MerchantDistanceTier[] {
  return tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
}

function updateZone(
  value: StoreAvailabilitySettings,
  index: number,
  patch: Partial<StoreAvailabilitySettings["deliveryZones"][number]>,
): StoreAvailabilitySettings {
  const zones = value.deliveryZones.map((z, i) =>
    i === index ? { ...z, ...patch } : z,
  );
  return { ...value, deliveryZones: zones };
}

export function MerchantSettingsDeliveryPanel(props: Props): ReactElement {
  const v = props.deliverySettings;
  const disabled = props.disabled ?? false;

  return (
    <div className="mp-settings-panel">
      <div>
        <p className="mp-settings-field__label">Режим доставки</p>
        <div className="mp-delivery-modes" role="radiogroup" aria-label="Режим доставки">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={v.pricingMode === mode}
              disabled={disabled}
              className={`mp-delivery-mode-card${v.pricingMode === mode ? " mp-delivery-mode-card--active" : ""}`}
              onClick={() =>
                props.onDeliverySettingsChange({
                  ...v,
                  pricingMode: mode,
                  distanceTiers:
                    mode === "DISTANCE_BASED" && v.distanceTiers.length === 0
                      ? DEFAULT_DISTANCE_TIERS.map((t) => ({ ...t }))
                      : v.distanceTiers,
                })
              }
            >
              <span className="mp-delivery-mode-card__label">
                {deliveryPricingModeLabelRu(mode)}
              </span>
              <span className="mp-delivery-mode-card__hint">{MODE_HINTS[mode]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mp-settings-inline-card">
        <label htmlFor="mp-min-order" className="mp-settings-inline-card__label">
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
            props.onDeliverySettingsChange({
              ...v,
              minOrderAmountSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
            })
          }
          list="mp-min-order-presets"
          className={archa.input}
        />
        <datalist id="mp-min-order-presets">
          {MIN_ORDER_PRESETS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      {v.pricingMode === "FIXED_PRICE" ? (
        <div className="mp-settings-inline-card">
          <label htmlFor="mp-fixed-price" className="mp-settings-inline-card__label">
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
              props.onDeliverySettingsChange({
                ...v,
                fixedPriceSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
              })
            }
            className={archa.input}
          />
        </div>
      ) : null}

      {v.pricingMode === "DISTANCE_BASED" ? (
        <div className="mp-settings-panel">
          <p className="mp-settings-field__label">Тарифы по расстоянию</p>
          {v.distanceTiers.map((tier, idx) => (
            <div key={idx} className="mp-delivery-tier-card">
              <div className="mp-delivery-tier-card__head">
                Тариф {idx + 1}
                {tier.maxKm == null ? " (без лимита)" : ""}
              </div>
              <div className="mp-delivery-tier-card__row">
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
                      props.onDeliverySettingsChange({
                        ...v,
                        distanceTiers: updateTier(v.distanceTiers, idx, {
                          maxKm: raw === "" ? null : Math.max(0, Number(raw)),
                        }),
                      });
                    }}
                    className={archa.input}
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
                      props.onDeliverySettingsChange({
                        ...v,
                        distanceTiers: updateTier(v.distanceTiers, idx, {
                          priceSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        }),
                      })
                    }
                    className={archa.input}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {v.pricingMode === "MANUAL_CONFIRMATION" ? (
        <p className="mp-settings-field__hint">
          На checkout покупатель увидит: «Стоимость доставки будет сообщена после
          подтверждения заказа».
        </p>
      ) : null}

      {props.availability.deliveryZones.length > 0 ? (
        <div>
          <p className="mp-settings-field__label">Зоны доставки</p>
          <div className="mp-settings-panel">
            {props.availability.deliveryZones.map((z, i) => (
              <div key={z.id} className="mp-zone-card">
                <input
                  className="mp-zone-card__title"
                  value={z.title}
                  disabled={disabled}
                  onChange={(e) =>
                    props.onAvailabilityChange(
                      updateZone(props.availability, i, { title: e.target.value }),
                    )
                  }
                  aria-label="Название зоны"
                />
                <div className="mp-zone-card__metrics">
                  <div className="mp-zone-card__row">
                    <span className="mp-zone-card__row-label">Расстояние</span>
                    <div className="mp-zone-card__row-fields">
                      <input
                        type="number"
                        min={0}
                        className="mp-zone-card__num"
                        disabled={disabled}
                        value={z.minKm}
                        onChange={(e) =>
                          props.onAvailabilityChange(
                            updateZone(props.availability, i, {
                              minKm: Number(e.target.value),
                            }),
                          )
                        }
                        aria-label="От км"
                      />
                      <span aria-hidden>—</span>
                      <input
                        type="number"
                        min={0}
                        className="mp-zone-card__num"
                        disabled={disabled}
                        placeholder="∞"
                        value={z.maxKm ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          props.onAvailabilityChange(
                            updateZone(props.availability, i, {
                              maxKm: raw === "" ? null : Number(raw),
                            }),
                          );
                        }}
                        aria-label="До км"
                      />
                      <span>км</span>
                    </div>
                  </div>
                  <div className="mp-zone-card__row">
                    <span className="mp-zone-card__row-label">ETA</span>
                    <div className="mp-zone-card__row-fields">
                      <input
                        type="number"
                        min={1}
                        className="mp-zone-card__num"
                        disabled={disabled}
                        value={z.eta.minMinutes}
                        onChange={(e) =>
                          props.onAvailabilityChange(
                            updateZone(props.availability, i, {
                              eta: { ...z.eta, minMinutes: Number(e.target.value) },
                            }),
                          )
                        }
                        aria-label="ETA мин"
                      />
                      <span aria-hidden>—</span>
                      <input
                        type="number"
                        min={1}
                        className="mp-zone-card__num"
                        disabled={disabled}
                        value={z.eta.maxMinutes}
                        onChange={(e) =>
                          props.onAvailabilityChange(
                            updateZone(props.availability, i, {
                              eta: { ...z.eta, maxMinutes: Number(e.target.value) },
                            }),
                          )
                        }
                        aria-label="ETA макс"
                      />
                      <span>мин</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
