import type React from "react";
import { useMemo } from "react";

type SchemaFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date";

type FieldSchema = {
  type: SchemaFieldType;
  label: string;
  required?: boolean;
  values?: string[];
};

export type SchemaObject = Record<string, FieldSchema>;

export function MerchantSettingsRenderer(props: {
  schema: SchemaObject;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement | null {
  const keys = useMemo(() => Object.keys(props.schema ?? {}), [props.schema]);
  if (keys.length === 0) return null;

  const { schema, value, onChange } = props;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {keys.map((key) => {
        const f = schema[key]!;
        const v = value[key];
        const label = f.required ? `${f.label} *` : f.label;

        if (f.type === "boolean") {
          return (
            <label key={key} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          );
        }

        if (f.type === "select") {
          const options = Array.isArray(f.values) ? f.values : [];
          return (
            <label key={key} style={{ display: "grid", gap: 6 }}>
              <span>{label}</span>
              <select
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
            </label>
          );
        }

        if (f.type === "multiselect") {
          const options = Array.isArray(f.values) ? f.values : [];
          const selected = Array.isArray(v) ? v.map(String) : [];
          return (
            <div key={key} style={{ display: "grid", gap: 6 }}>
              <div>{label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {options.map((opt) => {
                  const isOn = selected.includes(opt);
                  return (
                    <label key={opt} style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                      <span>{opt}</span>
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
            <label key={key} style={{ display: "grid", gap: 6 }}>
              <span>{label}</span>
              <input
                type="number"
                value={Number.isFinite(num as number) ? String(num) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({
                    ...value,
                    [key]: raw === "" ? "" : Number(raw),
                  });
                }}
              />
            </label>
          );
        }

        if (f.type === "date") {
          return (
            <label key={key} style={{ display: "grid", gap: 6 }}>
              <span>{label}</span>
              <input
                type="date"
                value={typeof v === "string" ? v.slice(0, 10) : ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              />
            </label>
          );
        }

        return (
          <label key={key} style={{ display: "grid", gap: 6 }}>
            <span>{label}</span>
            <input
              value={typeof v === "string" ? v : v == null ? "" : String(v)}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </label>
        );
      })}
    </div>
  );
}

