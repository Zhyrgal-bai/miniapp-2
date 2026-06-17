import type { BusinessType, PrismaClient } from "@prisma/client";
import { templateForBusinessType } from "../templates/index.js";

type CategoryCreateResult = {
  id: number;
  key: string;
};

async function createCategoryTree(
  prisma: PrismaClient,
  businessId: number,
  nodes: { key: string; name: string; children?: any[]; config?: Record<string, unknown> }[],
  parentId: number | null,
  out: CategoryCreateResult[],
): Promise<void> {
  for (const n of nodes) {
    const created = await prisma.category.create({
      // types can lag behind schema in editor; runtime columns exist after migration
      data: {
        businessId,
        name: n.name,
        parentId,
        config: { ...(n.config ?? {}), key: n.key },
      } as any,
      select: { id: true },
    });
    out.push({ id: created.id, key: n.key });
    if (Array.isArray(n.children) && n.children.length > 0) {
      await createCategoryTree(prisma, businessId, n.children, created.id, out);
    }
  }
}

/**
 * Applies template defaults to a newly created Business.
 * Safe to call multiple times: it will not overwrite existing categories/products.
 */
export async function applyBusinessTemplate(params: {
  prisma: PrismaClient;
  businessId: number;
  businessType: BusinessType;
  forceDemo?: boolean;
}): Promise<void> {
  const { prisma, businessId, businessType, forceDemo } = params;
  const tpl = templateForBusinessType(businessType);

  await prisma.$transaction(async (tx) => {
    // Theme + merchant config
    await tx.business.update({
      where: { id: businessId },
      data: {
        templateId: tpl.theme.templateId,
        themeConfig: tpl.theme.themeConfig as any,
        merchantConfig: tpl.merchantConfig as any,
        templateVersion: tpl.templateVersion ?? 1,
      } as any,
    });

    // Categories
    const existingCategory = await tx.category.findFirst({
      where: { businessId },
      select: { id: true },
    });
    let categoryKeyToId = new Map<string, number>();
    if (!existingCategory) {
      const created: CategoryCreateResult[] = [];
      await createCategoryTree(
        tx as unknown as PrismaClient,
        businessId,
        tpl.defaultCategories as any,
        null,
        created,
      );
      categoryKeyToId = new Map(created.map((c) => [c.key, c.id]));
    }

    // Demo products
    if (tpl.demoProducts.length > 0) {
      // If categories existed already, resolve IDs by name as fallback.
      if (categoryKeyToId.size === 0) {
        const cats = await tx.category.findMany({
          where: { businessId },
          select: { id: true, name: true },
        });
        // best-effort by name
        for (const node of tpl.defaultCategories) {
          const m = cats.find((c) => c.name === node.name);
          if (m) categoryKeyToId.set(node.key, m.id);
        }
      }

      const existingByName = new Set<string>();
      if (forceDemo) {
        const existingNames = await tx.product.findMany({
          where: { businessId },
          select: { name: true },
        });
        for (const r of existingNames) {
          if (typeof r.name === "string") existingByName.add(r.name);
        }
      } else {
        const existingProduct = await tx.product.findFirst({
          where: { businessId },
          select: { id: true },
        });
        if (existingProduct) {
          return;
        }
      }

      for (const p of tpl.demoProducts) {
        const categoryId = categoryKeyToId.get(p.categoryKey);
        if (!categoryId) continue;
        if (forceDemo && existingByName.has(p.name)) continue;
        await tx.product.create({
          data: {
            businessId,
            categoryId,
            name: p.name,
            price: p.price,
            image: p.image,
            images: [p.image],
            description: p.description ?? null,
            attributes: p.attributes ?? {},
          } as any,
        });
      }
    }
  });
}

