import type { Category } from "../types";

/** Корневые категории (группы витрины / родитель для подкатегорий). */
export function categoryRoots(all: Category[]): Category[] {
  return all
    .filter((c) => c.parentId == null || c.parentId === undefined)
    .slice()
    .sort((a, b) => {
      const sa = a.sortOrder ?? 0;
      const sb = b.sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });
}

export function flattenCategories(tree: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}
