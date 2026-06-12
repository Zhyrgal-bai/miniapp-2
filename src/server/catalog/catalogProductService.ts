import type { Prisma, Product, ProductStatus } from "@prisma/client";
import { prisma } from "../db.js";
import {
  type ParsedProductListQuery,
  type ProductBulkPatch,
  type ProductListSort,
} from "../../shared/catalogTypes.js";
import { resolveProductImagePublicIds } from "../../media/delete.js";
import { destroyPublicIdsBestEffort } from "../../media/mediaCleanupService.js";
import { logMediaAudit } from "../../media/mediaAuditService.js";

export type CatalogProductRow = Product & {
  category: { id: number; name: string; parentId: number | null; parent?: { id: number; name: string } | null };
};

function orderByForSort(sort: ProductListSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { id: "desc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "desc" }];
    case "name_asc":
      return [{ name: "asc" }, { id: "desc" }];
    case "newest":
    default:
      return [{ id: "desc" }];
  }
}

function statusWhere(query: ParsedProductListQuery): Prisma.ProductWhereInput {
  if (query.allStatuses) return {};
  if (query.statuses && query.statuses.length > 0) {
    return { status: { in: query.statuses } };
  }
  return { status: "ACTIVE" };
}

async function skuMatchIds(businessId: number, q: string): Promise<number[]> {
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Product"
    WHERE "businessId" = ${businessId}
      AND attributes::text ILIKE ${pattern}
  `;
  return rows.map((r) => r.id);
}

export async function buildProductWhere(
  businessId: number,
  query: ParsedProductListQuery,
): Promise<Prisma.ProductWhereInput> {
  const base: Prisma.ProductWhereInput = {
    businessId,
    ...statusWhere(query),
  };

  if (query.categoryId != null) {
    base.categoryId = query.categoryId;
  }

  if (query.q) {
    const q = query.q;
    const skuIds = await skuMatchIds(businessId, q);
    const textOr: Prisma.ProductWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      {
        category: {
          parent: { name: { contains: q, mode: "insensitive" } },
        },
      },
    ];
    if (skuIds.length > 0) {
      textOr.push({ id: { in: skuIds } });
    }
    base.AND = [{ OR: textOr }];
  }

  return base;
}

export async function listProducts(
  businessId: number,
  query: ParsedProductListQuery,
): Promise<
  | CatalogProductRow[]
  | { items: CatalogProductRow[]; total: number; limit: number; offset: number }
> {
  const where = await buildProductWhere(businessId, query);
  const orderBy = orderByForSort(query.sort);
  const include = {
    category: {
      include: {
        parent: { select: { id: true, name: true } },
      },
    },
  } as const;

  if (!query.paginated) {
    return prisma.product.findMany({
      where,
      orderBy,
      include,
    });
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      include,
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function archiveProduct(
  businessId: number,
  id: number,
): Promise<{ ok: true; product: Product } | { ok: false; status: 404 }> {
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists || exists.businessId !== businessId) {
    return { ok: false, status: 404 };
  }
  const product = await prisma.product.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  await logMediaAudit(prisma, {
    businessId,
    event: "ARCHIVE",
    productId: id,
    actor: { actorType: "merchant" },
    details: { imageCount: product.images?.length ?? 0 },
  });
  return { ok: true, product };
}

export async function restoreProduct(
  businessId: number,
  id: number,
): Promise<{ ok: true; product: Product } | { ok: false; status: 404 }> {
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists || exists.businessId !== businessId) {
    return { ok: false, status: 404 };
  }
  const product = await prisma.product.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  await logMediaAudit(prisma, {
    businessId,
    event: "RESTORE",
    productId: id,
    actor: { actorType: "merchant" },
    details: { imageCount: product.images?.length ?? 0 },
  });
  return { ok: true, product };
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deconflictAttributesForDuplicate(
  attributes: Record<string, unknown>,
  suffix: string,
): Record<string, unknown> {
  const out = deepCloneJson(attributes);
  if (typeof out.sku === "string" && out.sku.trim() !== "") {
    delete out.sku;
  }
  const variants = out.variants;
  if (Array.isArray(variants)) {
    out.variants = variants.map((v) => {
      if (v == null || typeof v !== "object" || Array.isArray(v)) return v;
      const row = { ...(v as Record<string, unknown>) };
      if (typeof row.sku === "string" && row.sku.trim() !== "") {
        row.sku = `${row.sku}${suffix}`;
      }
      return row;
    });
  }
  return out;
}

async function uniqueCopyName(businessId: number, baseName: string): Promise<string> {
  const candidate = `${baseName} (копия)`;
  const existing = await prisma.product.findFirst({
    where: { businessId, name: candidate },
    select: { id: true },
  });
  if (!existing) return candidate;
  return `${baseName} (копия ${Date.now()})`;
}

export async function duplicateProduct(
  businessId: number,
  id: number,
): Promise<{ ok: true; product: CatalogProductRow } | { ok: false; status: 404 }> {
  const source = await prisma.product.findUnique({
    where: { id },
    include: { stocks: true },
  });
  if (!source || source.businessId !== businessId) {
    return { ok: false, status: 404 };
  }

  const attrs =
    source.attributes != null &&
    typeof source.attributes === "object" &&
    !Array.isArray(source.attributes)
      ? (source.attributes as Record<string, unknown>)
      : {};
  const skuSuffix = `-copy-${Date.now()}`;
  const copyName = await uniqueCopyName(businessId, source.name);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: copyName,
        price: source.price,
        description: source.description,
        image: source.image,
        images: source.images,
        ...(source.imagesMeta != null
          ? { imagesMeta: source.imagesMeta as Prisma.InputJsonValue }
          : {}),
        categoryId: source.categoryId,
        businessId: source.businessId,
        attributes: deconflictAttributesForDuplicate(
          attrs,
          skuSuffix,
        ) as Prisma.InputJsonValue,
        preparationMinutes: source.preparationMinutes,
        status: "DRAFT",
      },
      include: {
        category: {
          include: {
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    for (const row of source.stocks) {
      await tx.productStock.create({
        data: {
          businessId: source.businessId,
          productId: created.id,
          size: row.size,
          color: row.color,
          variantKey: row.variantKey,
          available: row.available,
          reserved: 0,
          paid: 0,
          shipped: 0,
          returned: 0,
        },
      });
    }

    return created;
  });

  return { ok: true, product: product as CatalogProductRow };
}

export async function bulkPatchProducts(
  businessId: number,
  ids: number[],
  patch: ProductBulkPatch,
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { updated: 0 };

  if (patch.categoryId != null) {
    const category = await prisma.category.findUnique({
      where: { id: patch.categoryId },
      select: { id: true, businessId: true },
    });
    if (!category || category.businessId !== businessId) {
      throw new Error("INVALID_CATEGORY");
    }
  }

  const data: Prisma.ProductUncheckedUpdateManyInput = {};
  if (patch.status != null) data.status = patch.status;
  if (patch.categoryId != null) data.categoryId = patch.categoryId;

  const result = await prisma.product.updateMany({
    where: {
      businessId,
      id: { in: uniqueIds },
    },
    data,
  });

  return { updated: result.count };
}

export async function purgeProductPermanent(
  businessId: number,
  id: number,
): Promise<{ ok: true } | { ok: false; status: 404 }> {
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists || exists.businessId !== businessId) {
    return { ok: false, status: 404 };
  }

  try {
    const ids = resolveProductImagePublicIds(exists);
    await destroyPublicIdsBestEffort({
      prisma,
      businessId,
      publicIds: ids,
      reason: "product_permanent_purge",
      auditEvent: "PURGE",
      actor: { actorType: "operator" },
      skipReferenceGuard: false,
      allowLegacyStorefrontProductPaths: true,
    });
  } catch (e) {
    console.error("product purge cloudinary:", e);
  }

  await prisma.product.delete({ where: { id } });
  return { ok: true };
}

export function isProductVisibleOnStorefront(status: ProductStatus): boolean {
  return status === "ACTIVE";
}
