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

export type CategorySelectGroup = {
  rootId: number;
  rootName: string;
  options: Array<{ id: number; label: string }>;
};

/** Optgroup-ready options: root category + its subcategories grouped together. */
export function categorySelectGroups(tree: Category[]): CategorySelectGroup[] {
  return categoryRoots(tree).map((root) => {
    const children = root.children ?? [];
    if (children.length === 0) {
      return {
        rootId: root.id,
        rootName: root.name,
        options: [{ id: root.id, label: root.name }],
      };
    }
    return {
      rootId: root.id,
      rootName: root.name,
      options: [
        { id: root.id, label: `Все: ${root.name}` },
        ...children.map((ch) => ({ id: ch.id, label: ch.name })),
      ],
    };
  });
}

/** Flat select options with parent prefix (no optgroup — broken in Telegram WebView). */
export function categorySelectOptions(tree: Category[]): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  for (const group of categorySelectGroups(tree)) {
    const hasChildren = group.options.length > 1;
    for (const opt of group.options) {
      if (!hasChildren) {
        out.push({ id: opt.id, label: group.rootName });
        continue;
      }
      if (opt.id === group.rootId) {
        out.push({ id: opt.id, label: `${group.rootName} — все` });
        continue;
      }
      out.push({ id: opt.id, label: `${group.rootName} → ${opt.label}` });
    }
  }
  return out;
}

export function categoryPathLabel(
  categoryId: number | null | undefined,
  tree: Category[],
): string {
  if (categoryId == null || !Number.isFinite(categoryId)) return "—";
  for (const root of categoryRoots(tree)) {
    if (root.id === categoryId) return root.name;
    for (const child of root.children ?? []) {
      if (child.id === categoryId) return `${root.name} / ${child.name}`;
    }
  }
  const flat = flattenCategories(tree);
  const hit = flat.find((c) => c.id === categoryId);
  return hit?.name ?? "—";
}
