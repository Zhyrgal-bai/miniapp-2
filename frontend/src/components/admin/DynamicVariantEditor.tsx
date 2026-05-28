import { verticalProfileFor } from "@repo-shared/businessCommerce";
import {
  createEmptyOptionRow,
  type VariantOptionRow,
} from "./variantEditorUtils";

type Props = {
  businessType: string;
  rows: VariantOptionRow[];
  onChange: (rows: VariantOptionRow[]) => void;
  disabled?: boolean;
};

export function DynamicVariantEditor({ businessType, rows, onChange, disabled }: Props) {
  const profile = verticalProfileFor(businessType);
  const axis = profile.primaryAxisLabel || "Вариант";

  const updateRow = (id: string, patch: Partial<VariantOptionRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length > 0 ? next : [createEmptyOptionRow()]);
  };

  const addRow = () => {
    onChange([...rows, createEmptyOptionRow()]);
  };

  const placeholder =
    profile.variantEditor === "bouquet_tiers"
      ? "15 роз"
      : profile.businessType === "coffee"
        ? "500 мл"
        : profile.businessType === "fastfood"
          ? "Large"
          : "XXL";

  return (
    <div className="admin-variant-editor" style={{ marginTop: 16 }}>
      <p className="admin-dash-page__muted" style={{ marginBottom: 10 }}>
        {axis} и остатки — добавляйте любые значения
      </p>
      <div className="admin-variant-editor__list">
        {rows.map((row, index) => (
          <div key={row.id} className="admin-variant-option-row">
            <span className="admin-variant-option-row__index" aria-hidden>
              {index + 1}
            </span>
            <input
              type="text"
              className="admin-input admin-variant-option-row__label"
              value={row.label}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => updateRow(row.id, { label: e.target.value })}
              aria-label={`${axis} ${index + 1}`}
            />
            <input
              type="number"
              min={0}
              className="admin-input admin-variant-option-row__stock"
              disabled={disabled}
              value={row.stock}
              placeholder="Остаток"
              onChange={(e) => {
                const v = e.target.value;
                updateRow(row.id, {
                  stock: v === "" ? "" : Math.max(0, Number(v) || 0),
                });
              }}
              aria-label={`Остаток ${row.label || index + 1}`}
            />
            <button
              type="button"
              className="admin-variant-option-row__remove"
              disabled={disabled || rows.length <= 1}
              onClick={() => removeRow(row.id)}
              aria-label="Удалить вариант"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="admin-secondary-btn admin-variant-editor__add"
        disabled={disabled}
        onClick={addRow}
      >
        + Добавить {axis.toLowerCase()}
      </button>
    </div>
  );
}
