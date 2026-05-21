import { prisma } from "./db.js";
import {
  extractVariantsFromProductPayload,
  syncProductStockFromVariants,
  loadStockRowsByProductIds,
} from "./inventoryService.js";
import { findStockConsistencyIssues } from "../shared/productDto.js";
import {
  logInventoryMismatch,
  logInventoryHeal,
} from "./structuredLog.js";

export type InventoryHealthSummary = {
  productCount: number;
  mismatchCount: number;
  healedCount: number;
  issues: Array<{ productId: number; variantKey: string }>;
};

/** Sync ProductStock from attributes when drift detected (safe: attributes = admin write path). */
export async function healBusinessInventory(
  businessId: number,
  opts?: { dryRun?: boolean },
): Promise<InventoryHealthSummary> {
  const products = await prisma.product.findMany({
    where: { businessId },
    select: { id: true, attributes: true },
  });

  let mismatchCount = 0;
  let healedCount = 0;
  const issues: Array<{ productId: number; variantKey: string }> = [];

  for (const product of products) {
    const stockMap = await loadStockRowsByProductIds(businessId, [product.id]);
    const stockRows = stockMap.get(product.id) ?? [];
    const attrs = product.attributes as { variants?: unknown } | null;
    const found = findStockConsistencyIssues({
      catalogVariantsRaw: attrs?.variants,
      stockRows,
    });

    if (found.length === 0) continue;

    mismatchCount += found.length;
    for (const i of found) {
      issues.push({ productId: product.id, variantKey: i.variantKey });
    }

    logInventoryMismatch({
      businessId,
      productId: product.id,
      issues: found,
    });

    if (opts?.dryRun) continue;

    const variants = extractVariantsFromProductPayload(product.attributes);
    if (variants.length === 0) continue;

    await syncProductStockFromVariants({
      businessId,
      productId: product.id,
      variants,
    });
    healedCount += 1;
    logInventoryHeal({ businessId, productId: product.id, issueCount: found.length });
  }

  return {
    productCount: products.length,
    mismatchCount,
    healedCount,
    issues: issues.slice(0, 50),
  };
}

export async function healAllBusinessesInventory(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: { isBlocked: false },
    select: { id: true },
    take: 200,
  });
  let totalHealed = 0;
  for (const b of businesses) {
    const r = await healBusinessInventory(b.id);
    totalHealed += r.healedCount;
  }
  return totalHealed;
}
