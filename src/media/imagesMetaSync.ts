import type { ProductImageMeta, UploadResult } from "./types.js";
import { extractPublicIdFromCloudinaryUrl } from "./publicIdFromUrl.js";

function normalizeMetaEntry(raw: unknown): ProductImageMeta | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const url = typeof rec.url === "string" ? rec.url.trim() : "";
  const publicId = typeof rec.publicId === "string" ? rec.publicId.trim() : "";
  if (!url || !publicId) return null;
  const width = Number(rec.width ?? 0) || 0;
  const height = Number(rec.height ?? 0) || 0;
  const format =
    typeof rec.format === "string" && rec.format.trim() !== ""
      ? rec.format.trim()
      : undefined;
  return { url, publicId, width, height, ...(format ? { format } : {}) };
}

export function parseImagesMeta(raw: unknown): ProductImageMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductImageMeta[] = [];
  for (const item of raw) {
    const m = normalizeMetaEntry(item);
    if (m) out.push(m);
  }
  return out;
}

function uploadToMeta(asset: UploadResult): ProductImageMeta {
  return {
    url: asset.url,
    publicId: asset.publicId,
    width: asset.width,
    height: asset.height,
    ...(asset.format ? { format: asset.format } : {}),
  };
}

/**
 * Align imagesMeta with the ordered images[] URL list.
 * Preserves metadata for retained URLs; attaches new upload assets; backfills from URL parse.
 */
export function buildImagesMetaFromUrls(
  urls: string[],
  prevMetaRaw: unknown,
  newAssetsRaw?: unknown,
): ProductImageMeta[] {
  const prevMeta = parseImagesMeta(prevMetaRaw);
  const prevByUrl = new Map(prevMeta.map((m) => [m.url, m]));
  const prevByPid = new Map(prevMeta.map((m) => [m.publicId, m]));

  const newAssets: ProductImageMeta[] = [];
  if (Array.isArray(newAssetsRaw)) {
    for (const item of newAssetsRaw) {
      const direct = normalizeMetaEntry(item);
      if (direct) {
        newAssets.push(direct);
        continue;
      }
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (typeof rec.url === "string" && typeof rec.publicId === "string") {
          newAssets.push(uploadToMeta(item as UploadResult));
        }
      }
    }
  }
  const newByUrl = new Map(newAssets.map((m) => [m.url, m]));

  const out: ProductImageMeta[] = [];
  const usedPids = new Set<string>();

  for (const url of urls) {
    const trimmed = String(url ?? "").trim();
    if (!trimmed) continue;

    let meta =
      newByUrl.get(trimmed) ??
      prevByUrl.get(trimmed) ??
      null;

    if (!meta) {
      const pid = extractPublicIdFromCloudinaryUrl(trimmed);
      if (pid) meta = prevByPid.get(pid) ?? null;
    }

    if (!meta) {
      const pid = extractPublicIdFromCloudinaryUrl(trimmed);
      if (pid) {
        meta = { url: trimmed, publicId: pid, width: 0, height: 0 };
      }
    }

    if (meta && !usedPids.has(meta.publicId)) {
      usedPids.add(meta.publicId);
      out.push({ ...meta, url: trimmed });
    } else if (meta) {
      out.push({ ...meta, url: trimmed });
    }
  }

  return out;
}

export function imagesMetaToJson(meta: ProductImageMeta[]): ProductImageMeta[] {
  return meta.map((m) => ({
    url: m.url,
    publicId: m.publicId,
    width: m.width,
    height: m.height,
    ...(m.format ? { format: m.format } : {}),
  }));
}

export function publicIdsFromImagesMeta(meta: ProductImageMeta[]): string[] {
  return meta.map((m) => m.publicId).filter(Boolean);
}

export function findNewAssets(
  prevMeta: ProductImageMeta[],
  nextMeta: ProductImageMeta[],
): ProductImageMeta[] {
  const prevPids = new Set(prevMeta.map((m) => m.publicId));
  return nextMeta.filter((m) => !prevPids.has(m.publicId));
}
