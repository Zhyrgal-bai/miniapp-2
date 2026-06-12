import type { PrismaClient } from "@prisma/client";
import { diffAndDeleteRemovedAssets } from "./mediaCleanupService.js";
import { logMediaAudit } from "./mediaAuditService.js";
import type { MediaAuditActor } from "./mediaAuditService.js";
import { extractPublicIdFromCloudinaryUrl } from "./publicIdFromUrl.js";

export function logoPublicIdFromThemeConfig(themeConfig: unknown): string | null {
  if (themeConfig == null || typeof themeConfig !== "object" || Array.isArray(themeConfig)) {
    return null;
  }
  const pid = (themeConfig as Record<string, unknown>).logoPublicId;
  return typeof pid === "string" && pid.trim() !== "" ? pid.trim() : null;
}

export async function syncLogoReplaceCleanup(input: {
  prisma: PrismaClient;
  businessId: number;
  prevThemeConfig: unknown;
  nextLogoUrl: string | null;
  nextLogoPublicId: string | null;
  actor: MediaAuditActor;
}): Promise<void> {
  const prevPid =
    logoPublicIdFromThemeConfig(input.prevThemeConfig) ??
    (() => {
      if (
        input.prevThemeConfig == null ||
        typeof input.prevThemeConfig !== "object" ||
        Array.isArray(input.prevThemeConfig)
      ) {
        return null;
      }
      const url = (input.prevThemeConfig as Record<string, unknown>).logoUrl;
      return typeof url === "string"
        ? extractPublicIdFromCloudinaryUrl(url)
        : null;
    })();

  const nextPid =
    input.nextLogoPublicId ??
    (input.nextLogoUrl ? extractPublicIdFromCloudinaryUrl(input.nextLogoUrl) : null);

  if (prevPid && prevPid !== nextPid) {
    await diffAndDeleteRemovedAssets({
      prisma: input.prisma,
      businessId: input.businessId,
      prevIds: [prevPid],
      nextIds: nextPid ? [nextPid] : [],
      reason: "logo_replaced",
      auditEvent: "REPLACE",
      actor: input.actor,
      kindPrefix: "storefront",
    });
  }

  if (nextPid && nextPid !== prevPid) {
    await logMediaAudit(input.prisma, {
      businessId: input.businessId,
      event: "UPLOAD",
      publicId: nextPid,
      actor: input.actor,
      details: { url: input.nextLogoUrl, kind: "logo" },
    });
  }
}

export async function syncQrReplaceCleanup(input: {
  prisma: PrismaClient;
  businessId: number;
  prevQr: string | null;
  prevQrPublicId: string | null;
  nextQr: string | null;
  nextQrPublicId: string | null;
  actor: MediaAuditActor;
}): Promise<void> {
  const prevPid =
    input.prevQrPublicId ??
    (input.prevQr ? extractPublicIdFromCloudinaryUrl(input.prevQr) : null);
  const nextPid =
    input.nextQrPublicId ??
    (input.nextQr ? extractPublicIdFromCloudinaryUrl(input.nextQr) : null);

  if (prevPid && prevPid !== nextPid) {
    await diffAndDeleteRemovedAssets({
      prisma: input.prisma,
      businessId: input.businessId,
      prevIds: [prevPid],
      nextIds: nextPid ? [nextPid] : [],
      reason: "qr_replaced",
      auditEvent: "REPLACE",
      actor: input.actor,
      kindPrefix: "storefront",
    });
  }

  if (nextPid && nextPid !== prevPid) {
    await logMediaAudit(input.prisma, {
      businessId: input.businessId,
      event: "UPLOAD",
      publicId: nextPid,
      actor: input.actor,
      details: { url: input.nextQr, kind: "qr" },
    });
  }
}
