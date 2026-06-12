import type { PrismaClient } from "@prisma/client";
import type { ProductImageMeta } from "./types.js";
import {
  buildImagesMetaFromUrls,
  findNewAssets,
  imagesMetaToJson,
  parseImagesMeta,
  publicIdsFromImagesMeta,
} from "./imagesMetaSync.js";
import { extractCloudinaryPublicIds, resolveProductImagePublicIds } from "./delete.js";
import { diffAndDeleteRemovedAssets } from "./mediaCleanupService.js";
import { logMediaAudit, type MediaAuditActor } from "./mediaAuditService.js";

export type PrepareProductImagesInput = {
  urls: string[];
  prevImagesMeta?: unknown;
  incomingImagesMeta?: unknown;
};

export function prepareProductImagesMeta(
  input: PrepareProductImagesInput,
): ProductImageMeta[] {
  return buildImagesMetaFromUrls(
    input.urls,
    input.prevImagesMeta,
    input.incomingImagesMeta,
  );
}

export async function syncProductImagesOnUpdate(input: {
  prisma: PrismaClient;
  businessId: number;
  productId: number;
  exists: {
    imagesMeta?: unknown;
    images?: string[];
    image?: string | null;
  };
  nextUrls: string[];
  incomingImagesMeta?: unknown;
  actor: MediaAuditActor;
}): Promise<{ imagesMeta: ProductImageMeta[] }> {
  const prevMeta = parseImagesMeta(input.exists.imagesMeta);
  const prevIds = resolveProductImagePublicIds(input.exists);
  const nextMeta = prepareProductImagesMeta({
    urls: input.nextUrls,
    prevImagesMeta: input.exists.imagesMeta,
    incomingImagesMeta: input.incomingImagesMeta,
  });
  const nextIds = publicIdsFromImagesMeta(nextMeta);

  await diffAndDeleteRemovedAssets({
    prisma: input.prisma,
    businessId: input.businessId,
    prevIds,
    nextIds,
    reason: "product_image_removed",
    auditEvent: "DELETE",
    actor: input.actor,
    productId: input.productId,
    excludeProductId: input.productId,
    allowLegacyStorefrontProductPaths: true,
  });

  const newAssets = findNewAssets(prevMeta, nextMeta);
  for (const asset of newAssets) {
    await logMediaAudit(input.prisma, {
      businessId: input.businessId,
      event: "UPLOAD",
      publicId: asset.publicId,
      productId: input.productId,
      actor: input.actor,
      details: { url: asset.url },
    });
  }

  return { imagesMeta: nextMeta };
}

export async function auditProductImagesOnCreate(input: {
  prisma: PrismaClient;
  businessId: number;
  productId: number;
  imagesMeta: ProductImageMeta[];
  actor: MediaAuditActor;
}): Promise<void> {
  for (const asset of input.imagesMeta) {
    await logMediaAudit(input.prisma, {
      businessId: input.businessId,
      event: "UPLOAD",
      publicId: asset.publicId,
      productId: input.productId,
      actor: input.actor,
      details: { url: asset.url },
    });
  }
}

export { imagesMetaToJson };
