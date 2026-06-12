import type { PrismaClient } from "@prisma/client";
import { listTenantAssets } from "./cloudinary.js";
import { collectReferencedPublicIds } from "./referenceIndex.js";

export type OrphanScanResult = {
  businessId: number;
  referenced: string[];
  cloudinaryListed: string[];
  orphans: string[];
  scannedAt: string;
};

/**
 * Read-only orphan detection: Cloudinary assets under tenant prefix
 * not referenced in DB/config.
 */
export async function scanTenantOrphans(
  prisma: PrismaClient,
  businessId: number,
): Promise<OrphanScanResult> {
  const referencedSet = await collectReferencedPublicIds(prisma, businessId);
  const referenced = Array.from(referencedSet).sort();

  let cloudinaryListed: string[] = [];
  try {
    const listed = await listTenantAssets(businessId);
    cloudinaryListed = listed.map((a) => a.publicId).filter(Boolean).sort();
  } catch (e) {
    console.error("[scanTenantOrphans] listTenantAssets:", e);
  }

  const refSet = new Set(referenced);
  const orphans = cloudinaryListed.filter((pid) => !refSet.has(pid));

  return {
    businessId,
    referenced,
    cloudinaryListed,
    orphans,
    scannedAt: new Date().toISOString(),
  };
}
