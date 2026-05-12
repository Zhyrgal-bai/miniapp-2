import type React from "react";

export type SchemaFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date";

export type FieldSchema = {
  type: SchemaFieldType;
  label: string;
  required?: boolean;
  values?: string[];
};

export type SchemaObject = Record<string, FieldSchema>;

export function DynamicFieldRenderer(props: {
  schema: SchemaObject;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement | null {
  const { schema, value, onChange } = props;
  const keys = Object.keys(schema ?? {});
  if (keys.length === 0) return null;

  return (
    <div className="admin-form-section">
      <span className="admin-field-label">Доп. поля</span>
      <div style={{ display: "grid", gap: 12 }}>
        {keys.map((key) => {
          const f = schema[key]!;
          const v = value[key];
          const label = f.required ? `${f.label} *` : f.label;

          if (f.type === "boolean") {
            return (
              <label key={key} className="admin-size-chip">
                <input
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) =>
                    onChange({ ...value, [key]: e.target.checked })
                  }
                />
                <span className="admin-size-chip-text">{label}</span>
              </label>
            );
          }

          if (f.type === "select") {
            const options = Array.isArray(f.values) ? f.values : [];
            return (
              <div key={key}>
                <label className="admin-field-label" htmlFor={`dyn-${key}`}>
                  {label}
                </label>
                <select
                  id={`dyn-${key}`}
                  className="admin-select"
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                >
                  <option value="">—</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (f.type === "multiselect") {
            const options = Array.isArray(f.values) ? f.values : [];
            const selected = Array.isArray(v) ? v.map(String) : [];
            return (
              <div key={key}>
                <div className="admin-field-label">{label}</div>
                <div className="admin-sizes">
                  {options.map((opt) => {
                    const isOn = selected.includes(opt);
                    return (
                      <label key={opt} className="admin-size-chip">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(opt);
                            else next.delete(opt);
                            onChange({ ...value, [key]: Array.from(next) });
                          }}
                        />
                        <span className="admin-size-chip-text">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (f.type === "number") {
            const num = typeof v === "number" ? v : v == null ? "" : Number(v);
            return (
              <div key={key}>
                <label className="admin-field-label" htmlFor={`dyn-${key}`}>
                  {label}
                </label>
                <input
                  id={`dyn-${key}`}
                  type="number"
                  className="admin-input"
                  value={Number.isFinite(num as number) ? String(num) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({
                      ...value,
                      [key]: raw === "" ? "" : Number(raw),
                    });
                  }}
                />
              </div>
            );
          }

          if (f.type === "date") {
            return (
              <div key={key}>
                <label className="admin-field-label" htmlFor={`dyn-${key}`}>
                  {label}
                </label>
                <input
                  id={`dyn-${key}`}
                  type="date"
                  className="admin-input"
                  value={typeof v === "string" ? v.slice(0, 10) : ""}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                />
              </div>
            );
          }

          // text (default)
          return (
            <div key={key}>
              <label className="admin-field-label" htmlFor={`dyn-${key}`}>
                {label}
              </label>
              <input
                id={`dyn-${key}`}
                className="admin-input"
                value={typeof v === "string" ? v : v == null ? "" : String(v)}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                autoComplete="off"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

