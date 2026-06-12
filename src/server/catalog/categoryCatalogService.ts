import type { Category, Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export type CategoryTreeRow = {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  productsCount?: number;
  config?: unknown;
  children?: CategoryTreeRow[];
};

export function sortCategoriesForTree<T extends { sortOrder?: number; id: number }>(
  rows: T[],
): T[] {
  return rows.slice().sort((a, b) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
}

export function wouldCreateCategoryCycleFromRows(
  rows: Array<{ id: number; parentId: number | null }>,
  categoryId: number,
  newParentId: number | null,
): boolean {
  if (newParentId == null) return false;
  if (newParentId === categoryId) return true;

  const byId = new Map(rows.map((c) => [c.id, c.parentId]));

  const descendants = new Set<number>();
  for (const c of rows) {
    let cur: number | null = c.parentId;
    while (cur != null) {
      if (cur === categoryId) {
        descendants.add(c.id);
        break;
      }
      cur = byId.get(cur) ?? null;
    }
  }
  if (descendants.has(newParentId)) return true;

  let walk: number | null = newParentId;
  while (walk != null) {
    if (walk === categoryId) return true;
    walk = byId.get(walk) ?? null;
  }
  return false;
}

export async function wouldCreateCategoryCycle(
  categoryId: number,
  newParentId: number | null,
  businessId: number,
): Promise<boolean> {
  if (newParentId == null) return false;
  const all = await prisma.category.findMany({
    where: { businessId },
    select: { id: true, parentId: true },
  });
  return wouldCreateCategoryCycleFromRows(all, categoryId, newParentId);
}

export type CategoryUpdateInput = {
  name?: string;
  parentId?: number | null;
  sortOrder?: number;
};

export async function updateCategory(
  businessId: number,
  id: number,
  input: CategoryUpdateInput,
): Promise<
  | { ok: true; category: Category }
  | { ok: false; status: 400 | 404; error: string }
> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.businessId !== businessId) {
    return { ok: false, status: 404, error: "Категория не найдена" };
  }

  const data: Prisma.CategoryUpdateInput = {};

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name === "") {
      return { ok: false, status: 400, error: "Укажите название категории" };
    }
    data.name = name;
  }

  if (input.parentId !== undefined) {
    const parentId = input.parentId;
    if (parentId != null) {
      if (!Number.isFinite(parentId)) {
        return { ok: false, status: 400, error: "Неверный parentId" };
      }
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
        select: { id: true, businessId: true },
      });
      if (!parent || parent.businessId !== businessId) {
        return { ok: false, status: 400, error: "Неверная родительская категория" };
      }
      const cycle = await wouldCreateCategoryCycle(id, parentId, businessId);
      if (cycle) {
        return { ok: false, status: 400, error: "Нельзя создать цикл в дереве категорий" };
      }
    }
    data.parent = parentId == null ? { disconnect: true } : { connect: { id: parentId } };
  }

  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (!Number.isFinite(n)) {
      return { ok: false, status: 400, error: "Неверный sortOrder" };
    }
    data.sortOrder = Math.floor(n);
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, status: 400, error: "Нет полей для обновления" };
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data,
    });
    return { ok: true, category };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return {
        ok: false,
        status: 400,
        error: "Категория с таким названием уже существует",
      };
    }
    throw e;
  }
}

export type CategoryReorderItem = {
  id: number;
  sortOrder: number;
  parentId?: number | null;
};

export async function reorderCategories(
  businessId: number,
  updates: CategoryReorderItem[],
): Promise<{ ok: true; updated: number } | { ok: false; status: 400; error: string }> {
  if (updates.length === 0) {
    return { ok: false, status: 400, error: "Пустой список обновлений" };
  }

  const ids = updates.map((u) => u.id);
  const rows = await prisma.category.findMany({
    where: { businessId, id: { in: ids } },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    return { ok: false, status: 400, error: "Неверная категория" };
  }

  for (const u of updates) {
    if (u.parentId !== undefined && u.parentId != null) {
      const cycle = await wouldCreateCategoryCycle(u.id, u.parentId, businessId);
      if (cycle) {
        return { ok: false, status: 400, error: "Нельзя создать цикл в дереве категорий" };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      const data: Prisma.CategoryUpdateInput = { sortOrder: Math.floor(u.sortOrder) };
      if (u.parentId !== undefined) {
        data.parent =
          u.parentId == null ? { disconnect: true } : { connect: { id: u.parentId } };
      }
      await tx.category.update({ where: { id: u.id }, data });
    }
  });

  return { ok: true, updated: updates.length };
}

export function buildCategoryTree(
  categories: Array<{
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number;
    productsCount?: number;
    config?: unknown;
  }>,
): CategoryTreeRow[] {
  const nodeById = new Map<number, CategoryTreeRow>();
  for (const c of categories) {
    const node: CategoryTreeRow = {
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      config: c.config ?? {},
      children: [],
    };
    if (c.productsCount != null) node.productsCount = c.productsCount;
    nodeById.set(c.id, node);
  }

  const roots: CategoryTreeRow[] = [];
  for (const c of categories) {
    const node = nodeById.get(c.id)!;
    const parentId = c.parentId;
    if (parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = nodeById.get(parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children!.push(node);
  }

  const sortNode = (node: CategoryTreeRow) => {
    if (node.children && node.children.length > 0) {
      node.children = sortCategoriesForTree(node.children);
      for (const ch of node.children) sortNode(ch);
    }
  };

  const sortedRoots = sortCategoriesForTree(roots);
  for (const r of sortedRoots) sortNode(r);
  return sortedRoots;
}
