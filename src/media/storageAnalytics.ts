import type { PrismaClient } from "@prisma/client";
import { listTenantAssets, type ListedCloudinaryAsset } from "./cloudinary.js";
import { scanTenantOrphans } from "./orphanScanner.js";

export type TenantMediaStats = {
  businessId: number;
  assetCountByKind: Record<string, number>;
  totalListed: number;
  orphanEstimate: number;
  lastUploadAt: string | null;
  pendingDestroyJobs: number;
  scannedAt: string;
};

function countByKind(assets: ListedCloudinaryAsset[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of assets) {
    const parts = a.publicId.split("/");
    const kind = parts.length >= 2 ? parts[1] ?? "unknown" : "unknown";
    out[kind] = (out[kind] ?? 0) + 1;
  }
  return out;
}

export async function getTenantMediaStats(
  prisma: PrismaClient,
  businessId: number,
): Promise<TenantMediaStats> {
  let assets: ListedCloudinaryAsset[] = [];
  try {
    assets = await listTenantAssets(businessId);
  } catch (e) {
    console.error("[getTenantMediaStats] listTenantAssets:", e);
  }

  const orphanScan = await scanTenantOrphans(prisma, businessId);

  const lastUpload = await prisma.mediaAuditLog.findFirst({
    where: { businessId, event: "UPLOAD" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const pendingDestroyJobs = await prisma.mediaDestroyJob.count({
    where: { businessId, status: "PENDING" },
  });

  return {
    businessId,
    assetCountByKind: countByKind(assets),
    totalListed: assets.length,
    orphanEstimate: orphanScan.orphans.length,
    lastUploadAt: lastUpload?.createdAt?.toISOString() ?? null,
    pendingDestroyJobs,
    scannedAt: new Date().toISOString(),
  };
}
