import React from "react";

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export type StorefrontTextConfig = {
  heroDefaultTitle: string;
  addToCartLabel: string;
};

export function TextControls(props: {
  value: unknown;
  onChange: (next: StorefrontTextConfig) => void;
}): React.ReactElement {
  const current: StorefrontTextConfig = {
    heroDefaultTitle: readString(props.value, "heroDefaultTitle", "Добро пожаловать"),
    addToCartLabel: readString(props.value, "addToCartLabel", "Добавить"),
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.9, fontSize: 12 }}>Тексты (витрина)</div>
      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Hero заголовок по умолчанию (если в слайде пусто)
        <input
          defaultValue={current.heroDefaultTitle}
          onBlur={(e) =>
            props.onChange({
              ...current,
              heroDefaultTitle: e.target.value,
            })
          }
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Текст кнопки “Добавить в корзину”
        <input
          defaultValue={current.addToCartLabel}
          onBlur={(e) =>
            props.onChange({
              ...current,
              addToCartLabel: e.target.value,
            })
          }
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        />
      </label>
      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Эти тексты сохраняются <b>per-магазин</b> и применяются на витрине сразу в preview.
      </div>
    </div>
  );
}

