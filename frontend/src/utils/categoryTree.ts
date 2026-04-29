import type { Category } from "../types";

/** Корневые категории (группы витрины / родитель для подкатегорий). */
export function categoryRoots(all: Category[]): Category[] {
  return all
    .filter((c) => c.parentId == null || c.parentId === undefined)
    .slice()
    .sort((a, b) => a.id - b.id);
}
