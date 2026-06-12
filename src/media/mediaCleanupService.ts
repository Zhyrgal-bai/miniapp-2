import type { PrismaClient } from "@prisma/client";
import type { MediaAuditEvent } from "@prisma/client";
import { safeDeleteCloudinaryAsset } from "./delete.js";
import { logMediaAudit, type MediaAuditActor } from "./mediaAuditService.js";
import { enqueueMediaDestroy } from "./mediaDestroyQueue.js";
import { isPublicIdReferenced } from "./referenceIndex.js";

export type DiffDeleteInput = {
  prisma: PrismaClient;
  businessId: number;
  prevIds: string[];
  nextIds: string[];
  reason: string;
  auditEvent: MediaAuditEvent;
  actor: MediaAuditActor;
  productId?: number;
  excludeProductId?: number;
  /** Skip reference guard (tenant purge only). */
  skipReferenceGuard?: boolean;
  /** Optional kind prefix for safeDeleteCloudinaryAsset. */
  kindPrefix?: string;
  /** Allow legacy storefront folder paths during product purge. */
  allowLegacyStorefrontProductPaths?: boolean;
  /** Allow legacy global receipt paths during tenant purge. */
  allowGlobalReceiptPaths?: boolean;
};

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function kindPrefixForPublicId(
  publicId: string,
  allowLegacy: boolean,
): string | undefined {
  if (publicId.includes("/products/")) return "products";
  if (publicId.includes("/storefront/")) {
    return allowLegacy ? undefined : "storefront";
  }
  if (publicId.includes("/support/")) return "support";
  if (publicId.includes("/receipts/")) return "receipts";
  return undefined;
}

export async function diffAndDeleteRemovedAssets(
  input: DiffDeleteInput,
): Promise<{ deleted: string[]; skipped: string[]; failed: string[] }> {
  const prev = new Set(uniqueIds(input.prevIds));
  const next = new Set(uniqueIds(input.nextIds));
  const removed = [...prev].filter((id) => !next.has(id));

  const deleted: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const publicId of removed) {
    if (!input.skipReferenceGuard) {
      const stillRef = await isPublicIdReferenced(
        input.prisma,
        input.businessId,
        publicId,
        input.excludeProductId != null
          ? { excludeProductId: input.excludeProductId }
          : undefined,
      );
      if (stillRef) {
        skipped.push(publicId);
        continue;
      }
    }

    const kindPrefix =
      input.kindPrefix ??
      kindPrefixForPublicId(publicId, input.allowLegacyStorefrontProductPaths ?? false);

    const result = await safeDeleteCloudinaryAsset({
      businessId: input.businessId,
      publicId,
      ...(kindPrefix ? { kindPrefix } : {}),
      ...(input.allowGlobalReceiptPaths ? { allowGlobalReceiptPaths: true } : {}),
    });

    if (result.ok) {
      deleted.push(publicId);
      await logMediaAudit(input.prisma, {
        businessId: input.businessId,
        event: input.auditEvent,
        publicId,
        ...(input.productId != null ? { productId: input.productId } : {}),
        actor: input.actor,
        details: { reason: input.reason },
      });
    } else {
      failed.push(publicId);
      await enqueueMediaDestroy(input.prisma, {
        businessId: input.businessId,
        publicId,
        reason: `${input.reason}: ${result.error}`,
      });
    }
  }

  return { deleted, skipped, failed };
}

export async function destroyPublicIdsBestEffort(input: {
  prisma: PrismaClient;
  businessId: number;
  publicIds: string[];
  reason: string;
  auditEvent: MediaAuditEvent;
  actor: MediaAuditActor;
  skipReferenceGuard?: boolean;
  allowLegacyStorefrontProductPaths?: boolean;
  allowGlobalReceiptPaths?: boolean;
}): Promise<{ deleted: string[]; failed: string[] }> {
  const result = await diffAndDeleteRemovedAssets({
    prisma: input.prisma,
    businessId: input.businessId,
    prevIds: input.publicIds,
    nextIds: [],
    reason: input.reason,
    auditEvent: input.auditEvent,
    actor: input.actor,
    skipReferenceGuard: input.skipReferenceGuard ?? false,
    ...(input.allowLegacyStorefrontProductPaths
      ? { allowLegacyStorefrontProductPaths: true }
      : {}),
    ...(input.allowGlobalReceiptPaths ? { allowGlobalReceiptPaths: true } : {}),
  });
  return { deleted: result.deleted, failed: result.failed };
}
