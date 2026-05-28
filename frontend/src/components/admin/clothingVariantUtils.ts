import type { Variant } from "../../types";
import {
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
  resolvePickerHex,
} from "../../utils/variantColor";
import { getNormalizedVariants } from "../../utils/product";
import type { Product } from "../../types";
import { createEmptyOptionRow, newVariantRowId, type VariantOptionRow } from "./variantEditorUtils";

export type ClothingSizeRow = VariantOptionRow;

export type ClothingColorDraft = {
  id: string;
  colorName: string;
  colorHex: string;
  sizes: ClothingSizeRow[];
};

export function newColorVariantId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `cv-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function createEmptyColorVariant(): ClothingColorDraft {
  return {
    id: newColorVariantId(),
    colorName: "",
    colorHex: "#cccccc",
    sizes: [createEmptyOptionRow()],
  };
}

export function productToColorDrafts(product: Product): ClothingColorDraft[] {
  const vv = getNormalizedVariants(product);
  if (vv.length === 0) return [createEmptyColorVariant()];

  return vv.map((v) => {
    const sizes: ClothingSizeRow[] = (v.sizes ?? []).map((s) => ({
      id: newVariantRowId(),
      label: String(s.size ?? "").trim(),
      stock: Math.max(0, Number(s.stock ?? 0)),
    }));
    return {
      id: newColorVariantId(),
      colorName: v.color,
      colorHex: resolvePickerHex(v),
      sizes: sizes.length > 0 ? sizes : [createEmptyOptionRow()],
    };
  });
}

export function buildClothingVariantsForApi(drafts: ClothingColorDraft[]): Variant[] {
  return drafts
    .map((d) => {
      const name = d.colorName.trim();
      if (!name) return null;
      let hex = d.colorHex.trim();
      if (!isValidHexColor(hex)) {
        hex = lookupVariantHexByName(name) ?? "#cccccc";
      } else {
        hex = expandShortHex(hex);
      }
      const sizes = d.sizes
        .filter((s) => s.label.trim() !== "")
        .map((s) => {
          const st = s.stock;
          const stock = typeof st === "number" && !Number.isNaN(st) ? st : 0;
          return { size: s.label.trim(), stock };
        });
      if (sizes.length === 0) return null;
      return {
        color: { name, hex },
        sizes,
      } as unknown as Variant;
    })
    .filter((v): v is Variant => v != null);
}

export function validateClothingColorDrafts(drafts: ClothingColorDraft[]): string | null {
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (!d) continue;
    if (!d.colorName.trim()) {
      return `Вариант ${i + 1}: укажите название цвета.`;
    }
    const active = d.sizes.filter((s) => s.label.trim() !== "");
    if (active.length === 0) {
      return `Вариант ${i + 1}: добавьте хотя бы один размер.`;
    }
    for (const s of active) {
      const n = typeof s.stock === "number" ? s.stock : Number(s.stock);
      if (!Number.isFinite(n) || n <= 0) {
        return `Вариант ${i + 1}: для «${s.label.trim()}» укажите остаток больше нуля.`;
      }
    }
  }
  return null;
}
