import { useMemo } from "react";
import {
  WEEKDAY_KEYS,
  WEEKDAY_SHORT_RU,
  defaultStoreAvailabilitySettings,
  storeAvailabilityPreset,
  type DaySchedule,
  type DeliveryZone,
  type EtaRange,
  type StoreAvailabilityPresetId,
  type StoreAvailabilitySettings,
  type WeekdayKey,
} from "@repo-shared/storeAvailabilitySettings";
import "./MerchantStoreAvailabilityPanel.css";

type Props = {
  value: StoreAvailabilitySettings;
  businessType: string;
  onChange: (next: StoreAvailabilitySettings) => void;
};

const PRESETS: Array<{ id: StoreAvailabilityPresetId; label: string }> = [
  { id: "coffee", label: "Кофейня 08:00–22:00" },
  { id: "clothing", label: "Одежда 10:00–21:00" },
  { id: "fastfood", label: "Фастфуд 10:00–23:00" },
  { id: "flowers", label: "Цветы 08:00–21:00" },
  { id: "flowers_24_7", label: "Цветы 24/7" },
];

function updateDay(
  value: StoreAvailabilitySettings,
  day: WeekdayKey,
  patch: Partial<DaySchedule>,
): StoreAvailabilitySettings {
  return {
    ...value,
    schedule: {
      ...value.schedule,
      [day]: { ...value.schedule[day], ...patch },
    },
  };
}

function updateEta(
  value: StoreAvailabilitySettings,
  key: "deliveryEta" | "pickupEta",
  patch: Partial<EtaRange>,
): StoreAvailabilitySettings {
  return {
    ...value,
    [key]: { ...value[key], ...patch },
  };
}

function updateZone(
  value: StoreAvailabilitySettings,
  index: number,
  patch: Partial<DeliveryZone>,
): StoreAvailabilitySettings {
  const zones = value.deliveryZones.map((z, i) =>
    i === index ? { ...z, ...patch } : z,
  );
  return { ...value, deliveryZones: zones };
}

export function MerchantStoreAvailabilityPanel({
  value,
  businessType,
  onChange,
}: Props) {
  const normalized = useMemo(
    () => ({ ...defaultStoreAvailabilitySettings(), ...value }),
    [value],
  );

  const applyPreset = (id: StoreAvailabilityPresetId) => {
    onChange(storeAvailabilityPreset(id));
  };

  return (
    <div className="mp-avail-panel">
      <div className="mp-avail-panel__presets">
        <span className="mp-avail-panel__lead">Быстрые пресеты</span>
        <div className="mp-avail-panel__preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mp-btn mp-btn--ghost mp-btn--sm"
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mp-avail-panel__hint">
          Тип магазина: {businessType || "—"}. Часовой пояс:{" "}
          {normalized.timezone}
        </p>
      </div>

      <section className="mp-avail-panel__section" aria-label="График работы">
        <h3 className="mp-avail-panel__title">🏪 График работы</h3>
        <ul className="mp-avail-panel__schedule">
          {WEEKDAY_KEYS.map((day) => {
            const row = normalized.schedule[day];
            return (
              <li key={day} className="mp-avail-panel__schedule-row">
                <span className="mp-avail-panel__day">{WEEKDAY_SHORT_RU[day]}</span>
                <label className="mp-avail-panel__closed">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e) =>
                      onChange(updateDay(normalized, day, { closed: e.target.checked }))
                    }
                  />
                  Выходной
                </label>
                <input
                  type="time"
                  className="mp-avail-panel__time"
                  disabled={row.closed}
                  value={row.open}
                  onChange={(e) =>
                    onChange(updateDay(normalized, day, { open: e.target.value }))
                  }
                />
                <span>—</span>
                <input
                  type="time"
                  className="mp-avail-panel__time"
                  disabled={row.closed}
                  value={row.close}
                  onChange={(e) =>
                    onChange(updateDay(normalized, day, { close: e.target.value }))
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mp-avail-panel__section" aria-label="ETA">
        <h3 className="mp-avail-panel__title">⏱ ETA</h3>
        <div className="mp-avail-panel__eta-grid">
          <div>
            <label className="mp-avail-panel__label">🚚 Доставка (мин)</label>
            <div className="mp-avail-panel__range">
              <input
                type="number"
                min={1}
                className="mp-avail-panel__num"
                value={normalized.deliveryEta.minMinutes}
                onChange={(e) =>
                  onChange(
                    updateEta(normalized, "deliveryEta", {
                      minMinutes: Number(e.target.value),
                    }),
                  )
                }
              />
              <span>—</span>
              <input
                type="number"
                min={1}
                className="mp-avail-panel__num"
                value={normalized.deliveryEta.maxMinutes}
                onChange={(e) =>
                  onChange(
                    updateEta(normalized, "deliveryEta", {
                      maxMinutes: Number(e.target.value),
                    }),
                  )
                }
              />
            </div>
          </div>
          <div>
            <label className="mp-avail-panel__label">📦 Самовывоз (мин)</label>
            <div className="mp-avail-panel__range">
              <input
                type="number"
                min={1}
                className="mp-avail-panel__num"
                value={normalized.pickupEta.minMinutes}
                onChange={(e) =>
                  onChange(
                    updateEta(normalized, "pickupEta", {
                      minMinutes: Number(e.target.value),
                    }),
                  )
                }
              />
              <span>—</span>
              <input
                type="number"
                min={1}
                className="mp-avail-panel__num"
                value={normalized.pickupEta.maxMinutes}
                onChange={(e) =>
                  onChange(
                    updateEta(normalized, "pickupEta", {
                      maxMinutes: Number(e.target.value),
                    }),
                  )
                }
              />
            </div>
          </div>
        </div>
        <div className="mp-avail-panel__toggles">
          <label>
            <input
              type="checkbox"
              checked={normalized.deliveryEnabled}
              onChange={(e) =>
                onChange({ ...normalized, deliveryEnabled: e.target.checked })
              }
            />
            Доставка доступна
          </label>
          <label>
            <input
              type="checkbox"
              checked={normalized.pickupEnabled}
              onChange={(e) =>
                onChange({ ...normalized, pickupEnabled: e.target.checked })
              }
            />
            Самовывоз доступен
          </label>
        </div>
      </section>

      <section className="mp-avail-panel__section" aria-label="Зоны доставки">
        <h3 className="mp-avail-panel__title">🌍 Зоны доставки</h3>
        <ul className="mp-avail-panel__zones">
          {normalized.deliveryZones.map((z, i) => (
            <li key={z.id} className="mp-avail-panel__zone">
              <input
                className="mp-avail-panel__zone-title"
                value={z.title}
                onChange={(e) =>
                  onChange(updateZone(normalized, i, { title: e.target.value }))
                }
              />
              <div className="mp-avail-panel__zone-row">
                <input
                  type="number"
                  min={0}
                  className="mp-avail-panel__num mp-avail-panel__num--sm"
                  value={z.minKm}
                  onChange={(e) =>
                    onChange(updateZone(normalized, i, { minKm: Number(e.target.value) }))
                  }
                />
                <span>—</span>
                <input
                  type="number"
                  min={0}
                  className="mp-avail-panel__num mp-avail-panel__num--sm"
                  value={z.maxKm ?? ""}
                  placeholder="∞"
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    onChange(
                      updateZone(normalized, i, {
                        maxKm: v === "" ? null : Number(v),
                      }),
                    );
                  }}
                />
                <span>км · ETA</span>
                <input
                  type="number"
                  min={1}
                  className="mp-avail-panel__num mp-avail-panel__num--sm"
                  value={z.eta.minMinutes}
                  onChange={(e) =>
                    onChange(
                      updateZone(normalized, i, {
                        eta: { ...z.eta, minMinutes: Number(e.target.value) },
                      }),
                    )
                  }
                />
                <span>—</span>
                <input
                  type="number"
                  min={1}
                  className="mp-avail-panel__num mp-avail-panel__num--sm"
                  value={z.eta.maxMinutes}
                  onChange={(e) =>
                    onChange(
                      updateZone(normalized, i, {
                        eta: { ...z.eta, maxMinutes: Number(e.target.value) },
                      }),
                    )
                  }
                />
                <span>мин</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
