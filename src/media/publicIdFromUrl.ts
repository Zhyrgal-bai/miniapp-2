/**
 * Extract Cloudinary public_id from a secure_url.
 * Supports URLs with transformation segments after /upload/.
 */
export function extractPublicIdFromCloudinaryUrl(input: string): string | null {
  const url = String(input ?? "").trim();
  if (!url) return null;
  if (!/^https:\/\/res\.cloudinary\.com\//i.test(url)) return null;

  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;

  let tail = url.slice(idx + marker.length);
  // Strip query/hash
  tail = tail.split("?")[0]?.split("#")[0] ?? tail;
  if (!tail) return null;

  const parts = tail.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // Skip version segment v1234567890
  let start = 0;
  if (/^v\d+$/.test(parts[0] ?? "")) {
    start = 1;
  }

  // Skip Cloudinary transformation segments (e.g. f_auto,q_auto / w_300)
  while (start < parts.length) {
    const seg = parts[start] ?? "";
    if (/^v\d+$/.test(seg)) {
      start += 1;
      continue;
    }
    const looksLikeTransform =
      seg.includes(",") ||
      /^(f_|q_|w_|h_|c_|g_|e_|b_|dpr_|ar_|fl_)/i.test(seg);
    if (looksLikeTransform) {
      start += 1;
      continue;
    }
    break;
  }

  if (start >= parts.length) return null;
  const publicIdParts = parts.slice(start);
  const last = publicIdParts[publicIdParts.length - 1] ?? "";
  // Remove file extension from last segment if present
  if (/\.[a-z0-9]{2,5}$/i.test(last)) {
    publicIdParts[publicIdParts.length - 1] = last.replace(/\.[a-z0-9]{2,5}$/i, "");
  }

  const publicId = publicIdParts.join("/");
  return publicId.trim() !== "" ? publicId : null;
}

export function resolvePublicIdsFromUrls(urls: string[]): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    const pid = extractPublicIdFromCloudinaryUrl(u);
    if (pid) out.add(pid);
  }
  return Array.from(out);
}
