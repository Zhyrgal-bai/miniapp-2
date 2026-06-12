import type { PrismaClient } from "@prisma/client";
import { extractCloudinaryPublicIds } from "./delete.js";
import {
  parseImagesMeta,
  publicIdsFromImagesMeta,
} from "./imagesMetaSync.js";
import {
  extractPublicIdFromCloudinaryUrl,
  resolvePublicIdsFromUrls,
} from "./publicIdFromUrl.js";

export type CollectReferencedOptions = {
  /** Exclude this product when scanning products (during product image diff). */
  excludeProductId?: number;
};

function addPid(out: Set<string>, pid: string | null | undefined): void {
  const t = typeof pid === "string" ? pid.trim() : "";
  if (t) out.add(t);
}

function addFromUrls(out: Set<string>, urls: string[]): void {
  for (const pid of resolvePublicIdsFromUrls(urls)) {
    out.add(pid);
  }
}

function collectFromJsonPhotos(raw: unknown, out: Set<string>): void {
  if (!Array.isArray(raw)) return;
  for (const item of raw) {
    if (typeof item === "string") {
      addPid(out, extractPublicIdFromCloudinaryUrl(item));
    } else if (item != null && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      if (typeof rec.url === "string") {
        addPid(out, extractPublicIdFromCloudinaryUrl(rec.url));
      }
      if (typeof rec.publicId === "string") addPid(out, rec.publicId);
    }
  }
}

function logoPublicIdFromTheme(themeConfig: unknown): string | null {
  if (themeConfig == null || typeof themeConfig !== "object" || Array.isArray(themeConfig)) {
    return null;
  }
  const rec = themeConfig as Record<string, unknown>;
  const pid = rec.logoPublicId;
  return typeof pid === "string" && pid.trim() !== "" ? pid.trim() : null;
}

/**
 * Collect all Cloudinary publicIds referenced by a tenant in DB/config.
 */
export async function collectReferencedPublicIds(
  prisma: PrismaClient,
  businessId: number,
  opts?: CollectReferencedOptions,
): Promise<Set<string>> {
  const out = new Set<string>();

  const products = await prisma.product.findMany({
    where: {
      businessId,
      ...(opts?.excludeProductId != null
        ? { id: { not: opts.excludeProductId } }
        : {}),
    },
    select: { imagesMeta: true, images: true, image: true },
  });

  for (const p of products) {
    const meta = parseImagesMeta(p.imagesMeta);
    for (const pid of publicIdsFromImagesMeta(meta)) {
      out.add(pid);
    }
    const urls = [
      ...(Array.isArray(p.images) ? p.images : []),
      ...(p.image ? [p.image] : []),
    ];
    addFromUrls(out, urls);
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      themeConfig: true,
      storefrontDraftConfig: true,
      storefrontPublishedConfig: true,
      storefrontConfig: true,
    },
  });

  if (business) {
    addPid(out, logoPublicIdFromTheme(business.themeConfig));
    for (const pid of extractCloudinaryPublicIds(business.themeConfig)) {
      out.add(pid);
    }
    for (const cfg of [
      business.storefrontDraftConfig,
      business.storefrontPublishedConfig,
      business.storefrontConfig,
    ]) {
      for (const pid of extractCloudinaryPublicIds(cfg)) {
        out.add(pid);
      }
    }
  }

  const storefronts = await prisma.storefront.findMany({
    where: { businessId },
    select: { draftConfig: true, publishedConfig: true },
  });
  for (const sf of storefronts) {
    for (const pid of extractCloudinaryPublicIds(sf.draftConfig)) {
      out.add(pid);
    }
    for (const pid of extractCloudinaryPublicIds(sf.publishedConfig)) {
      out.add(pid);
    }
  }

  const blocks = await prisma.storefrontReusableBlock.findMany({
    where: { businessId },
    select: { config: true },
  });
  for (const b of blocks) {
    for (const pid of extractCloudinaryPublicIds(b.config)) {
      out.add(pid);
    }
  }

  const settings = await prisma.settings.findUnique({
    where: { businessId },
    select: { qr: true, qrPublicId: true, logoUrl: true },
  });
  if (settings) {
    addPid(out, settings.qrPublicId);
    if (settings.qr) addPid(out, extractPublicIdFromCloudinaryUrl(settings.qr));
    if (settings.logoUrl) {
      addPid(out, extractPublicIdFromCloudinaryUrl(settings.logoUrl));
    }
  }

  const orders = await prisma.order.findMany({
    where: { businessId, receiptUrl: { not: null } },
    select: { receiptUrl: true },
  });
  for (const o of orders) {
    if (o.receiptUrl) {
      addPid(out, extractPublicIdFromCloudinaryUrl(o.receiptUrl));
    }
  }

  const returns = await prisma.returnRequest.findMany({
    where: { businessId },
    select: { photos: true },
  });
  for (const r of returns) {
    collectFromJsonPhotos(r.photos, out);
  }

  return out;
}

export async function isPublicIdReferenced(
  prisma: PrismaClient,
  businessId: number,
  publicId: string,
  opts?: CollectReferencedOptions,
): Promise<boolean> {
  const pid = publicId.trim();
  if (!pid) return false;
  const refs = await collectReferencedPublicIds(prisma, businessId, opts);
  return refs.has(pid);
}
