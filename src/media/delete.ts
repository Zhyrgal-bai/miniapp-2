import { deleteImage, isCloudinaryConfigured } from "./cloudinary.js";

function collectPublicIdsFromUnknown(v: unknown, out: Set<string>): void {
  if (v == null) return;
  if (typeof v === "string") return;
  if (Array.isArray(v)) {
    for (const it of v) collectPublicIdsFromUnknown(it, out);
    return;
  }
  if (typeof v !== "object") return;
  const rec = v as Record<string, unknown>;
  for (const [k, val] of Object.entries(rec)) {
    if (
      (k === "imagePublicId" || k === "publicId") &&
      typeof val === "string" &&
      val.trim() !== ""
    ) {
      out.add(val.trim());
      continue;
    }
    collectPublicIdsFromUnknown(val, out);
  }
}

export function extractCloudinaryPublicIds(input: unknown): string[] {
  const out = new Set<string>();
  collectPublicIdsFromUnknown(input, out);
  return Array.from(out);
}

export async function safeDeleteCloudinaryAsset(params: {
  businessId: number;
  publicId: string | null | undefined;
  kindPrefix?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pid = typeof params.publicId === "string" ? params.publicId.trim() : "";
  if (!pid) return { ok: true };
  if (!isCloudinaryConfigured()) {
    return { ok: false, error: "Cloudinary not configured" };
  }
  const prefix = `business_${params.businessId}/`;
  if (!pid.startsWith(prefix)) {
    return { ok: false, error: "Refuse to delete чужой asset" };
  }
  if (params.kindPrefix && !pid.startsWith(`${prefix}${params.kindPrefix}/`)) {
    return { ok: false, error: "Refuse to delete asset из другой папки" };
  }
  try {
    await deleteImage(pid);
    return { ok: true };
  } catch (e) {
    console.error("[cloudinary destroy]", e);
    return { ok: false, error: "Destroy failed" };
  }
}

