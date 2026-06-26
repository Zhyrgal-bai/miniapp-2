import { useMemo, type ReactElement } from "react";
import { archa } from "../../../archa/archaUi";
import {
  DEFAULT_MERCHANT_REGIONS,
  type MerchantDeliveryRegion,
  type MerchantDeliverySettings,
} from "@repo-shared/merchantDeliverySettings";
import type { MerchantDeliveryProviderPolicy } from "../../../../types/deliveryAdmin.types";
import {
  WEEKDAY_SHORT_RU,
  WEEKDAY_KEYS,
  type StoreAvailabilitySettings,
} from "@repo-shared/storeAvailabilitySettings";

const MIN_ORDER_PRESETS = [0, 500, 1000, 2000, 3000];

type Props = {
  deliverySettings: MerchantDeliverySettings;
  onDeliverySettingsChange: (v: MerchantDeliverySettings) => void;
  providerPolicy: MerchantDeliveryProviderPolicy;
  onProviderPolicyChange: (v: MerchantDeliveryProviderPolicy) => void;
  availability: StoreAvailabilitySettings;
  onAvailabilityChange: (v: StoreAvailabilitySettings) => void;
  disabled?: boolean;
};

function newRegionId(): string {
  return `region-${Date.now().toString(36)}`;
}

function updateRegion(
  regions: MerchantDeliveryRegion[],
  index: number,
  patch: Partial<MerchantDeliveryRegion>,
): MerchantDeliveryRegion[] {
  return regions.map((r, i) => (i === index ? { ...r, ...patch } : r));
}

function scheduleSummary(availability: StoreAvailabilitySettings): string {
  const openDays = WEEKDAY_KEYS.filter((d) => !availability.schedule[d].closed);
  if (openDays.length === 0) return "Закрыто";
  if (openDays.length === 7) {
    const mon = availability.schedule.mon;
    return `Ежедневно ${mon.open}–${mon.close}`;
  }
  return openDays.map((d) => WEEKDAY_SHORT_RU[d]).join(", ");
}

export function MerchantSettingsDeliveryPanel(props: Props): ReactElement {
  const v = props.deliverySettings;
  const policy = props.providerPolicy;
  const availability = props.availability;
  const disabled = props.disabled ?? false;

  const regions = useMemo(
    () => (v.regions.length > 0 ? v.regions : DEFAULT_MERCHANT_REGIONS.map((r) => ({ ...r }))),
    [v.regions],
  );

  const patchDelivery = (patch: Partial<MerchantDeliverySettings>) => {
    props.onDeliverySettingsChange({
      ...v,
      pricingMode: "REGION_BASED",
      ...patch,
    });
  };

  const patchPolicy = (patch: Partial<MerchantDeliveryProviderPolicy>) => {
    props.onProviderPolicyChange({ ...policy, ...patch });
  };

  return (
    <div className="mp-settings-panel">
      <p className="mp-settings-field__hint" style={{ marginBottom: 12 }}>
        Гибридная доставка: сначала живой расчёт Yandex, при недоступности — фиксированная
        цена по региону магазина.
      </p>

      <section className="mp-hybrid-provider-card">
        <div className="mp-hybrid-provider-card__head">
          <div>
            <h3 className="mp-hybrid-provider-card__title">Yandex Delivery</h3>
            <p className="mp-hybrid-provider-card__desc">
              Живая цена из Yandex Delivery API. Без ручных тарифов.
            </p>
          </div>
          <label className="mp-toggle">
            <input
              type="checkbox"
              checked={policy.enabled}
              disabled={disabled}
              onChange={(e) => patchPolicy({ enabled: e.target.checked })}
            />
            <span>Включено</span>
          </label>
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
              patchDelivery({
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

        <div className="mp-settings-inline-card">
          <span className="mp-settings-inline-card__label">Часы работы доставки</span>
          <p className="mp-settings-field__hint">{scheduleSummary(availability)}</p>
          <p className="mp-settings-field__hint">
            Измените в разделе «График» или включите доставку ниже.
          </p>
        </div>

        <div className="mp-settings-grid-2">
          <label className="mp-settings-field__label">
            Лимит цены (сом, опц.)
            <input
              type="number"
              min={0}
              step={50}
              disabled={disabled || !policy.enabled}
              placeholder="Без лимита"
              value={policy.maxPriceSom ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patchPolicy({
                  maxPriceSom: raw === "" ? null : Math.max(0, Math.round(Number(raw))),
                });
              }}
              className={archa.input}
            />
          </label>
          <label className="mp-settings-field__label">
            Лимит ETA (мин, опц.)
            <input
              type="number"
              min={5}
              step={5}
              disabled={disabled || !policy.enabled}
              placeholder="Без лимита"
              value={policy.maxEtaMinutes ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patchPolicy({
                  maxEtaMinutes: raw === "" ? null : Math.max(5, Math.round(Number(raw))),
                });
              }}
              className={archa.input}
            />
          </label>
        </div>

        <label className="mp-checkbox-row">
          <input
            type="checkbox"
            checked={policy.allowFallback}
            disabled={disabled || !policy.enabled}
            onChange={(e) => patchPolicy({ allowFallback: e.target.checked })}
          />
          <span>При недоступности Yandex — доставка магазином</span>
        </label>
      </section>

      <section className="mp-hybrid-provider-card">
        <div className="mp-hybrid-provider-card__head">
          <div>
            <h3 className="mp-hybrid-provider-card__title">Доставка магазином</h3>
            <p className="mp-hybrid-provider-card__desc">
              Фиксированные цены по регионам (город / населённый пункт).
            </p>
          </div>
          <label className="mp-toggle">
            <input
              type="checkbox"
              checked={v.merchantDeliveryEnabled}
              disabled={disabled}
              onChange={(e) =>
                patchDelivery({
                  merchantDeliveryEnabled: e.target.checked,
                  regions,
                })
              }
            />
            <span>Включено</span>
          </label>
        </div>

        <label className="mp-checkbox-row">
          <input
            type="checkbox"
            checked={availability.deliveryEnabled}
            disabled={disabled}
            onChange={(e) =>
              props.onAvailabilityChange({
                ...availability,
                deliveryEnabled: e.target.checked,
              })
            }
          />
          <span>Принимать заказы с доставкой</span>
        </label>

        <label className="mp-checkbox-row">
          <input
            type="checkbox"
            checked={availability.pickupEnabled}
            disabled={disabled}
            onChange={(e) =>
              props.onAvailabilityChange({
                ...availability,
                pickupEnabled: e.target.checked,
              })
            }
          />
          <span>Самовывоз</span>
        </label>

        {v.merchantDeliveryEnabled ? (
          <div className="mp-settings-panel">
            <p className="mp-settings-field__label">Регионы и цены</p>
            {regions.map((region, idx) => (
              <div key={region.id} className="mp-region-card">
                <div className="mp-region-card__row">
                  <label className="mp-settings-field__label">
                    Регион
                    <input
                      type="text"
                      disabled={disabled}
                      value={region.name}
                      onChange={(e) =>
                        patchDelivery({
                          regions: updateRegion(regions, idx, {
                            name: e.target.value.slice(0, 80),
                          }),
                        })
                      }
                      className={archa.input}
                      placeholder="Бишкек"
                    />
                  </label>
                  <label className="mp-settings-field__label">
                    Цена (сом)
                    <input
                      type="number"
                      min={0}
                      step={10}
                      disabled={disabled}
                      value={region.priceSom}
                      onChange={(e) =>
                        patchDelivery({
                          regions: updateRegion(regions, idx, {
                            priceSom: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          }),
                        })
                      }
                      className={archa.input}
                    />
                  </label>
                </div>
                <label className="mp-settings-field__label">
                  Примечание (опц.)
                  <input
                    type="text"
                    disabled={disabled}
                    value={region.notes ?? ""}
                    onChange={(e) =>
                      patchDelivery({
                        regions: updateRegion(regions, idx, {
                          notes: e.target.value.trim() === "" ? null : e.target.value.slice(0, 200),
                        }),
                      })
                    }
                    className={archa.input}
                    placeholder="Например: только будни"
                  />
                </label>
                {regions.length > 1 ? (
                  <button
                    type="button"
                    className="mp-btn-ghost mp-btn-ghost--danger"
                    disabled={disabled}
                    onClick={() =>
                      patchDelivery({
                        regions: regions.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    Удалить регион
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="mp-btn-secondary"
              disabled={disabled}
              onClick={() =>
                patchDelivery({
                  regions: [
                    ...regions,
                    {
                      id: newRegionId(),
                      name: "",
                      priceSom: 0,
                      notes: null,
                    },
                  ],
                })
              }
            >
              + Добавить регион
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
