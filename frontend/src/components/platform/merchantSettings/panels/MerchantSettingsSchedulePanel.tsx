import { useMemo, useState, type ReactElement } from "react";
import {
  WEEKDAY_KEYS,
  WEEKDAY_SHORT_RU,
  defaultStoreAvailabilitySettings,
  storeAvailabilityPreset,
  type DaySchedule,
  type StoreAvailabilityPresetId,
  type StoreAvailabilitySettings,
  type WeekdayKey,
} from "@repo-shared/storeAvailabilitySettings";

const PRESETS: Array<{ id: StoreAvailabilityPresetId; label: string }> = [
  { id: "coffee", label: "Кофейня" },
  { id: "clothing", label: "Одежда" },
  { id: "fastfood", label: "Фастфуд" },
  { id: "flowers", label: "Цветы" },
  { id: "flowers_24_7", label: "24/7" },
];

type Props = {
  value: StoreAvailabilitySettings;
  businessType: string;
  onChange: (next: StoreAvailabilitySettings) => void;
};

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
  patch: Partial<StoreAvailabilitySettings["deliveryEta"]>,
): StoreAvailabilitySettings {
  return {
    ...value,
    [key]: { ...value[key], ...patch },
  };
}

function copyScheduleToAll(
  value: StoreAvailabilitySettings,
  sourceDay: WeekdayKey,
): StoreAvailabilitySettings {
  const source = value.schedule[sourceDay];
  const schedule = { ...value.schedule };
  for (const day of WEEKDAY_KEYS) {
    if (day === sourceDay) continue;
    schedule[day] = { ...source };
  }
  return { ...value, schedule };
}

export function MerchantSettingsSchedulePanel(props: Props): ReactElement {
  const normalized = useMemo(
    () => ({ ...defaultStoreAvailabilitySettings(), ...props.value }),
    [props.value],
  );

  const [copySource, setCopySource] = useState<WeekdayKey>("mon");

  return (
    <div className="mp-settings-panel">
      <div>
        <p className="mp-settings-field__label">Быстрые пресеты</p>
        <div className="mp-schedule-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mp-schedule-preset"
              onClick={() => props.onChange(storeAvailabilityPreset(p.id))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mp-settings-field__hint">
          Тип: {props.businessType || "—"} · {normalized.timezone}
        </p>
      </div>

      <div>
        <p className="mp-settings-field__label">График по дням</p>
        <ul className="mp-schedule-list">
          {WEEKDAY_KEYS.map((day) => {
            const row = normalized.schedule[day];
            return (
              <li
                key={day}
                className={`mp-schedule-day${row.closed ? " mp-schedule-day--closed" : ""}`}
              >
                <span className="mp-schedule-day__label">{WEEKDAY_SHORT_RU[day]}</span>
                <div className="mp-schedule-day__times">
                  <input
                    type="time"
                    className="mp-schedule-day__time"
                    disabled={row.closed}
                    value={row.open}
                    onChange={(e) =>
                      props.onChange(updateDay(normalized, day, { open: e.target.value }))
                    }
                    aria-label={`Открытие ${WEEKDAY_SHORT_RU[day]}`}
                  />
                  <span>—</span>
                  <input
                    type="time"
                    className="mp-schedule-day__time"
                    disabled={row.closed}
                    value={row.close}
                    onChange={(e) =>
                      props.onChange(updateDay(normalized, day, { close: e.target.value }))
                    }
                    aria-label={`Закрытие ${WEEKDAY_SHORT_RU[day]}`}
                  />
                </div>
                <label className="mp-schedule-day__closed-toggle">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e) =>
                      props.onChange(updateDay(normalized, day, { closed: e.target.checked }))
                    }
                  />
                  Вых.
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mp-schedule-copy-bar">
          <span className="mp-settings-field__hint" style={{ margin: 0 }}>
            Скопировать время:
          </span>
          <select
            value={copySource}
            onChange={(e) => setCopySource(e.target.value as WeekdayKey)}
            className="mp-schedule-copy-btn"
            aria-label="День-источник"
          >
            {WEEKDAY_KEYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_SHORT_RU[d]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mp-schedule-copy-btn"
            onClick={() => props.onChange(copyScheduleToAll(normalized, copySource))}
          >
            На все дни
          </button>
          <button
            type="button"
            className="mp-schedule-copy-btn"
            onClick={() => {
              const weekdays = WEEKDAY_KEYS.filter((d) => d !== "sat" && d !== "sun");
              const source = normalized.schedule[copySource];
              const schedule = { ...normalized.schedule };
              for (const day of weekdays) {
                schedule[day] = { ...source };
              }
              props.onChange({ ...normalized, schedule });
            }}
          >
            На будни
          </button>
        </div>
      </div>

      <div className="mp-settings-field-row">
        <div className="mp-settings-inline-card">
          <span className="mp-settings-inline-card__label">Доставка (мин)</span>
          <div className="mp-schedule-day__times">
            <input
              type="number"
              min={1}
              className="mp-schedule-day__time"
              value={normalized.deliveryEta.minMinutes}
              onChange={(e) =>
                props.onChange(
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
              className="mp-schedule-day__time"
              value={normalized.deliveryEta.maxMinutes}
              onChange={(e) =>
                props.onChange(
                  updateEta(normalized, "deliveryEta", {
                    maxMinutes: Number(e.target.value),
                  }),
                )
              }
            />
          </div>
        </div>
        <div className="mp-settings-inline-card">
          <span className="mp-settings-inline-card__label">Самовывоз (мин)</span>
          <div className="mp-schedule-day__times">
            <input
              type="number"
              min={1}
              className="mp-schedule-day__time"
              value={normalized.pickupEta.minMinutes}
              onChange={(e) =>
                props.onChange(
                  updateEta(normalized, "pickupEta", { minMinutes: Number(e.target.value) }),
                )
              }
            />
            <span>—</span>
            <input
              type="number"
              min={1}
              className="mp-schedule-day__time"
              value={normalized.pickupEta.maxMinutes}
              onChange={(e) =>
                props.onChange(
                  updateEta(normalized, "pickupEta", { maxMinutes: Number(e.target.value) }),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="mp-settings-inline-card">
        <label className="mp-settings-field__label">
          <input
            type="checkbox"
            checked={normalized.deliveryEnabled}
            onChange={(e) =>
              props.onChange({ ...normalized, deliveryEnabled: e.target.checked })
            }
          />{" "}
          Доставка доступна
        </label>
        <label className="mp-settings-field__label" style={{ marginTop: "0.5rem" }}>
          <input
            type="checkbox"
            checked={normalized.pickupEnabled}
            onChange={(e) =>
              props.onChange({ ...normalized, pickupEnabled: e.target.checked })
            }
          />{" "}
          Самовывоз доступен
        </label>
      </div>
    </div>
  );
}
