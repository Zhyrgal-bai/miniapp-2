import type React from "react";
import {
  filterStorefrontOrderOptionsSchema,
  verticalProfileFor,
} from "@repo-shared/businessCommerce";
import type { FieldSchema, SchemaObject } from "../../admin/DynamicFieldRenderer";
import { storefrontVerticalExperience } from "../../../storefront/verticalExperience";
import "./verticalOrderOptionsExperience.css";

type Props = {
  businessType: string | null | undefined;
  merchantConfig?: Record<string, unknown> | null;
  schema: SchemaObject;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

const FIELD_ORDER: Record<string, string[]> = {
  flowers: ["deliveryDate", "packaging", "occasion", "postcardText"],
  coffee: ["hotOrCold", "sugar", "syrups"],
  fastfood: ["combo", "spicy", "addons"],
  electronics: ["serialNumber"],
  autoparts: ["vin", "compatibility"],
  cosmetics: ["skinType"],
  furniture: ["assemblyRequired"],
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  hotOrCold: { hot: "Горячий", ice: "Холодный" },
  sugar: { no: "Без сахара", less: "Меньше", normal: "Обычно" },
  syrups: { vanilla: "Ваниль", caramel: "Карамель", hazelnut: "Лесной орех" },
  spicy: { no: "Не острое", mild: "Средне", hot: "Остро" },
  packaging: { paper: "Бумага", box: "Коробка" },
  addons: { cheese: "Сыр", bacon: "Бекон", sauce: "Соус" },
  skinType: {
    all: "Для всех",
    dry: "Сухая",
    normal: "Нормальная",
    oily: "Жирная",
    combo: "Комбинированная",
    sensitive: "Чувствительная",
  },
};

function labelForValue(fieldKey: string, raw: string): string {
  return VALUE_LABELS[fieldKey]?.[raw] ?? raw;
}

function sectionTitle(
  vertical: string,
  key: string,
  fieldLabel: string,
): string {
  if (vertical === "flowers") {
    if (key === "deliveryDate") return "Когда доставить";
    if (key === "postcardText") return "Открытка";
    if (key === "occasion") return "Повод";
    if (key === "packaging") return "Упаковка";
  }
  if (vertical === "coffee") {
    if (key === "hotOrCold") return "Температура";
    if (key === "sugar") return "Сахар";
    if (key === "syrups") return "Сиропы";
  }
  if (vertical === "fastfood") {
    if (key === "combo") return "Комбо";
    if (key === "spicy") return "Острота";
    if (key === "addons") return "Добавки";
  }
  if (vertical === "electronics") {
    if (key === "serialNumber") return "Серийный номер";
  }
  if (vertical === "autoparts") {
    if (key === "vin") return "VIN";
    if (key === "compatibility") return "Совместимость";
  }
  if (vertical === "cosmetics") {
    if (key === "skinType") return "Тип кожи";
  }
  if (vertical === "furniture") {
    if (key === "assemblyRequired") return "Нужна сборка";
  }
  return fieldLabel;
}

type OrderField = FieldSchema & { maxLen?: number; default?: unknown };

function renderSelectPills(
  key: string,
  field: OrderField,
  vertical: string,
  v: unknown,
  onChange: (next: Record<string, unknown>) => void,
  value: Record<string, unknown>,
): React.ReactElement {
  const options = Array.isArray(field.values) ? field.values : [];
  const current = typeof v === "string" ? v : "";
  const label = sectionTitle(vertical, key, field.label ?? key);
  const isTemp = key === "hotOrCold";

  return (
    <section
      key={key}
      className={`vx-order-field vx-order-field--select${isTemp ? " vx-order-field--temp" : ""}`}
    >
      <h3 className="vx-order-field__label">{label}</h3>
      <div className={`vx-pills${isTemp ? " vx-pills--temp" : ""}`} role="listbox" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={current === opt}
            className={`vx-pill${current === opt ? " is-active" : ""}`}
            onClick={() => onChange({ ...value, [key]: opt })}
          >
            {isTemp && opt === "hot" ? <span className="vx-pill__icon" aria-hidden>☕</span> : null}
            {isTemp && opt === "ice" ? <span className="vx-pill__icon" aria-hidden>🧊</span> : null}
            {labelForValue(key, opt)}
          </button>
        ))}
      </div>
    </section>
  );
}

function renderMultiselect(
  key: string,
  field: OrderField,
  vertical: string,
  v: unknown,
  onChange: (next: Record<string, unknown>) => void,
  value: Record<string, unknown>,
): React.ReactElement {
  const options = Array.isArray(field.values) ? field.values : [];
  const selected = Array.isArray(v) ? v.map(String) : [];
  const label = sectionTitle(vertical, key, field.label ?? key);

  return (
    <section key={key} className="vx-order-field vx-order-field--multiselect">
      <h3 className="vx-order-field__label">{label}</h3>
      <div className="vx-pills vx-pills--wrap" role="group" aria-label={label}>
        {options.map((opt) => {
          const isOn = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={isOn}
              className={`vx-pill vx-pill--toggle${isOn ? " is-active" : ""}`}
              onClick={() => {
                const next = new Set(selected);
                if (isOn) next.delete(opt);
                else next.add(opt);
                onChange({ ...value, [key]: Array.from(next) });
              }}
            >
              {labelForValue(key, opt)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function renderBooleanToggle(
  key: string,
  field: OrderField,
  vertical: string,
  v: unknown,
  onChange: (next: Record<string, unknown>) => void,
  value: Record<string, unknown>,
): React.ReactElement {
  const on = v === true;
  const label = sectionTitle(vertical, key, field.label ?? key);

  return (
    <section key={key} className="vx-order-field vx-order-field--boolean">
      <button
        type="button"
        className={`vx-toggle-card${on ? " is-active" : ""}`}
        aria-pressed={on}
        onClick={() => onChange({ ...value, [key]: !on })}
      >
        <span className="vx-toggle-card__title">{label}</span>
        <span className="vx-toggle-card__hint">
          {on ? "Добавлено к заказу" : "Нажмите, чтобы добавить"}
        </span>
      </button>
    </section>
  );
}

function renderDate(
  key: string,
  field: OrderField,
  vertical: string,
  v: unknown,
  onChange: (next: Record<string, unknown>) => void,
  value: Record<string, unknown>,
): React.ReactElement {
  const label = sectionTitle(vertical, key, field.label ?? key);
  const dateVal = typeof v === "string" ? v.slice(0, 10) : "";

  return (
    <section key={key} className="vx-order-field vx-order-field--date">
      <h3 className="vx-order-field__label">{label}</h3>
      <div className="vx-date-card">
        <input
          type="date"
          className="vx-date-card__input"
          value={dateVal}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          aria-label={label}
        />
      </div>
    </section>
  );
}

function renderText(
  key: string,
  field: OrderField,
  vertical: string,
  v: unknown,
  onChange: (next: Record<string, unknown>) => void,
  value: Record<string, unknown>,
): React.ReactElement {
  const label = sectionTitle(vertical, key, field.label ?? key);
  const isPostcard = key === "postcardText";

  return (
    <section
      key={key}
      className={`vx-order-field vx-order-field--text${isPostcard ? " vx-order-field--postcard" : ""}`}
    >
      <h3 className="vx-order-field__label">{label}</h3>
      {isPostcard ? (
        <div className="vx-postcard">
          <textarea
            className="vx-postcard__input"
            rows={3}
            maxLength={field.maxLen ?? 280}
            placeholder="Напишите пожелание…"
            value={typeof v === "string" ? v : ""}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            aria-label={label}
          />
        </div>
      ) : (
        <input
          type="text"
          className="vx-text-input"
          maxLength={field.maxLen ?? 80}
          placeholder="Например: день рождения"
          value={typeof v === "string" ? v : ""}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          aria-label={label}
        />
      )}
    </section>
  );
}

function renderField(
  key: string,
  field: OrderField,
  vertical: string,
  value: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
): React.ReactElement | null {
  const v = value[key];
  const type = field.type ?? "text";

  if (type === "select") return renderSelectPills(key, field, vertical, v, onChange, value);
  if (type === "multiselect") return renderMultiselect(key, field, vertical, v, onChange, value);
  if (type === "boolean") return renderBooleanToggle(key, field, vertical, v, onChange, value);
  if (type === "date") return renderDate(key, field, vertical, v, onChange, value);
  if (type === "text" || type === "number") return renderText(key, field, vertical, v, onChange, value);
  return null;
}

/** Vertical-native order options on PDP — gift card, menu modifiers, combo builder. */
export function VerticalOrderOptionsExperience({
  businessType,
  merchantConfig,
  schema,
  value,
  onChange,
}: Props): React.ReactElement | null {
  const profile = verticalProfileFor(businessType, merchantConfig);
  if (!profile.showOrderOptionsOnStorefront) return null;

  const vertical = storefrontVerticalExperience(businessType);
  if (vertical === "default" || vertical === "clothing") return null;

  const filtered = filterStorefrontOrderOptionsSchema(
    businessType,
    schema as Record<string, unknown>,
  ) as SchemaObject;

  const keys = Object.keys(filtered);
  if (keys.length === 0) return null;

  const order = FIELD_ORDER[vertical] ?? keys;
  const sortedKeys = [
    ...order.filter((k) => k in filtered),
    ...keys.filter((k) => !order.includes(k)),
  ];

  return (
    <div className={`vx-order-options vx-order-options--${vertical}`} data-vx-vertical={vertical}>
      {sortedKeys.map((key) => {
        const field = filtered[key];
        if (!field || typeof field !== "object") return null;
        return renderField(key, field as OrderField, vertical, value, onChange);
      })}
    </div>
  );
}
