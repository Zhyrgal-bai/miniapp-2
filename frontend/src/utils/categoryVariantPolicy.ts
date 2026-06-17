import type { Category } from "../types";

function readCategoryConfig(category: Category | null | undefined): Record<string, unknown> {
  const raw = category?.config;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function findCategoryInTree(
  roots: Category[],
  categoryId: number,
): Category | null {
  for (const root of roots) {
    if (root.id === categoryId) return root;
    for (const child of root.children ?? []) {
      if (child.id === categoryId) return child;
    }
  }
  return null;
}

/** Accessories and similar categories sell without size matrix. */
export function categorySkipsClothingSizes(category: Category | null | undefined): boolean {
  if (!category) return false;
  const cfg = readCategoryConfig(category);
  if (cfg.noSizes === true) return true;
  if (typeof cfg.key === "string" && cfg.key.trim().toLowerCase() === "accessories") {
    return true;
  }
  return /^аксессуар/i.test(category.name.trim());
}

export function categorySkipsClothingSizesById(
  categoryId: number | null | undefined,
  roots: Category[],
): boolean {
  if (categoryId == null || !Number.isFinite(categoryId)) return false;
  return categorySkipsClothingSizes(findCategoryInTree(roots, categoryId));
}
