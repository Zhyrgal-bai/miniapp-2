import type { PrismaClient } from "@prisma/client";
import { listTenantAssets } from "./cloudinary.js";
import { destroyPublicIdsBestEffort } from "./mediaCleanupService.js";
import { collectReferencedPublicIds } from "./referenceIndex.js";
import { extractPublicIdFromCloudinaryUrl } from "./publicIdFromUrl.js";
import { logMediaAudit } from "./mediaAuditService.js";

/**
 * Destroy all Cloudinary assets for a tenant before/after DB purge.
 * Uses folder listing + referenced receipt URLs; skips reference guard.
 */
export async function purgeTenantCloudinaryAssets(
  prisma: PrismaClient,
  businessId: number,
  actor: { actorType: "merchant" | "operator" | "system"; actorUserId?: number | null },
): Promise<{ listed: number; destroyed: number; failed: number }> {
  const toDestroy = new Set<string>();

  const referenced = await collectReferencedPublicIds(prisma, businessId);
  for (const pid of referenced) {
    toDestroy.add(pid);
  }

  try {
    const listed = await listTenantAssets(businessId);
    for (const asset of listed) {
      if (asset.publicId) toDestroy.add(asset.publicId);
    }
  } catch (e) {
    console.error("[purgeTenantCloudinaryAssets] listTenantAssets:", e);
  }

  const orders = await prisma.order.findMany({
    where: { businessId, receiptUrl: { not: null } },
    select: { receiptUrl: true },
  });
  for (const o of orders) {
    if (o.receiptUrl) {
      const pid = extractPublicIdFromCloudinaryUrl(o.receiptUrl);
      if (pid) toDestroy.add(pid);
    }
  }

  const ids = Array.from(toDestroy);
  const result = await destroyPublicIdsBestEffort({
    prisma,
    businessId,
    publicIds: ids,
    reason: "business_purge",
    auditEvent: "PURGE",
    actor,
    skipReferenceGuard: true,
    allowLegacyStorefrontProductPaths: true,
    allowGlobalReceiptPaths: true,
  });

  await logMediaAudit(prisma, {
    businessId,
    event: "PURGE",
    actor,
    details: {
      listed: ids.length,
      destroyed: result.deleted.length,
      failed: result.failed.length,
    },
  });

  return {
    listed: ids.length,
    destroyed: result.deleted.length,
    failed: result.failed.length,
  };
}
