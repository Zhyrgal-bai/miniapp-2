import {
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
} from "../../utils/variantColor";
import {
  createEmptyOptionRow,
  type VariantOptionRow,
} from "./variantEditorUtils";
import type { ClothingColorDraft } from "./clothingVariantUtils";
import { createEmptyColorVariant } from "./clothingVariantUtils";

const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "черный", hex: "#000000" },
  { name: "белый", hex: "#ffffff" },
  { name: "серый", hex: "#808080" },
  { name: "молочный", hex: "#fff8e7" },
  { name: "темно-синий", hex: "#00008b" },
];

type Props = {
  drafts: ClothingColorDraft[];
  onChange: (drafts: ClothingColorDraft[]) => void;
  disabled?: boolean;
  noSizes?: boolean;
};

export function ClothingVariantEditor({ drafts, onChange, disabled, noSizes }: Props) {
  const updateDraft = (id: string, patch: Partial<ClothingColorDraft>) => {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const updateSize = (draftId: string, sizeId: string, patch: Partial<VariantOptionRow>) => {
    onChange(
      drafts.map((d) => {
        if (d.id !== draftId) return d;
        return {
          ...d,
          sizes: d.sizes.map((s) => (s.id === sizeId ? { ...s, ...patch } : s)),
        };
      }),
    );
  };

  const addSize = (draftId: string) => {
    onChange(
      drafts.map((d) =>
        d.id === draftId ? { ...d, sizes: [...d.sizes, createEmptyOptionRow()] } : d,
      ),
    );
  };

  const removeSize = (draftId: string, sizeId: string) => {
    onChange(
      drafts.map((d) => {
        if (d.id !== draftId) return d;
        const next = d.sizes.filter((s) => s.id !== sizeId);
        return { ...d, sizes: next.length > 0 ? next : [createEmptyOptionRow()] };
      }),
    );
  };

  const removeDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    onChange(next.length > 0 ? next : [createEmptyColorVariant()]);
  };

  return (
    <div className="admin-variant-editor admin-variant-editor--matrix">
      <p className="admin-form-hint">
        {noSizes
          ? "Аксессуары — укажите цвет и остаток, размеры не нужны"
          : "Цвета и размеры — любые названия, остаток по каждому SKU"}
      </p>

      {drafts.map((draft, index) => (
        <details key={draft.id} className="admin-variant" open={index === 0}>
          <summary className="admin-variant-head">
            <span className="admin-variant-title">
              {draft.colorName.trim() !== "" ? draft.colorName : `Цвет ${index + 1}`}
            </span>
            {drafts.length > 1 ? (
              <button
                type="button"
                className="admin-variant-remove"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  removeDraft(draft.id);
                }}
              >
                Удалить цвет
              </button>
            ) : null}
          </summary>

          <div className="admin-form-section">
            <span className="admin-field-label">Цвет</span>
            <div className="admin-color-picker-row">
              <input
                type="color"
                className="admin-color-native"
                disabled={disabled}
                aria-label={`Цвет ${index + 1}`}
                value={
                  isValidHexColor(draft.colorHex)
                    ? expandShortHex(draft.colorHex)
                    : "#cccccc"
                }
                onChange={(e) => updateDraft(draft.id, { colorHex: e.target.value })}
              />
              <input
                className="admin-input admin-color-name-input"
                disabled={disabled}
                placeholder="например: светло-серый"
                value={draft.colorName}
                onChange={(e) => {
                  const next = e.target.value;
                  const mapped = lookupVariantHexByName(next);
                  updateDraft(draft.id, {
                    colorName: next,
                    ...(mapped ? { colorHex: mapped } : {}),
                  });
                }}
                autoComplete="off"
              />
            </div>
            <div className="admin-color-presets" role="group" aria-label="Быстрый выбор цвета">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="admin-color-preset-btn"
                  disabled={disabled}
                  onClick={() =>
                    updateDraft(draft.id, { colorName: p.name, colorHex: p.hex })
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-stock-block">
            <span className="admin-field-label">{noSizes ? "Остаток" : "Размеры"}</span>
            {noSizes ? (
              <div className="admin-variant-editor__list">
                <div className="admin-variant-option-row admin-variant-option-row--stock-only">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="admin-input admin-variant-option-row__stock"
                    disabled={disabled}
                    placeholder="Сколько штук в наличии"
                    value={draft.sizes[0]?.stock ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const stock = raw === "" ? "" : Math.max(0, Number(raw) || 0);
                      onChange(
                        drafts.map((d) => {
                          if (d.id !== draft.id) return d;
                          const rows = d.sizes.length > 0 ? d.sizes : [createEmptyOptionRow()];
                          const first = rows[0]!;
                          return {
                            ...d,
                            sizes: rows.map((s) =>
                              s.id === first.id ? { ...s, stock } : s,
                            ),
                          };
                        }),
                      );
                    }}
                    aria-label="Остаток"
                  />
                </div>
              </div>
            ) : (
              <>
            <div className="admin-variant-editor__list">
              {draft.sizes.map((sizeRow, si) => (
                <div key={sizeRow.id} className="admin-variant-option-row">
                  <input
                    type="text"
                    className="admin-input admin-variant-option-row__label"
                    disabled={disabled}
                    placeholder="S, 48, Oversize…"
                    value={sizeRow.label}
                    onChange={(e) =>
                      updateSize(draft.id, sizeRow.id, { label: e.target.value })
                    }
                    aria-label={`Размер ${si + 1}`}
                  />
                  <input
                    type="number"
                    min={0}
                    className="admin-input admin-variant-option-row__stock"
                    disabled={disabled}
                    placeholder="Остаток"
                    value={sizeRow.stock}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateSize(draft.id, sizeRow.id, {
                        stock: v === "" ? "" : Math.max(0, Number(v) || 0),
                      });
                    }}
                    aria-label={`Остаток ${sizeRow.label || si + 1}`}
                  />
                  <button
                    type="button"
                    className="admin-variant-option-row__remove"
                    disabled={disabled || draft.sizes.length <= 1}
                    onClick={() => removeSize(draft.id, sizeRow.id)}
                    aria-label="Удалить размер"
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
              onClick={() => addSize(draft.id)}
            >
              + Добавить размер
            </button>
              </>
            )}
          </div>
        </details>
      ))}

      <button
        type="button"
        className="admin-secondary-btn"
        disabled={disabled}
        onClick={() => onChange([...drafts, createEmptyColorVariant()])}
      >
        + Добавить цвет
      </button>
    </div>
  );
}
