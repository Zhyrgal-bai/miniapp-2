import type { Category } from "../types";

/** Подкатегория, если есть; иначе main без детей (лист). */
export function resolveProductCategoryId(
  mainCategoryId: number | "",
  subCategoryId: number | "",
  roots: Category[],
): number | null {
  if (subCategoryId !== "") return Number(subCategoryId);
  if (mainCategoryId === "") return null;
  const root = roots.find((r) => r.id === mainCategoryId);
  const kids = root?.children ?? [];
  if (kids.length === 0) return Number(mainCategoryId);
  return null;
}
