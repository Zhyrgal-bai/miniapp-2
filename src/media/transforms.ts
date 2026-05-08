export type ImagePreset = "thumbnail" | "storefront" | "hero" | "preview";

const PRESET_TRANSFORM: Record<ImagePreset, string> = {
  thumbnail: "f_auto,q_auto,w_300",
  storefront: "f_auto,q_auto,w_1200",
  hero: "f_auto,q_auto,w_1600",
  preview: "f_auto,q_auto,w_800",
};

function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\//i.test(url);
}

/**
 * Cloudinary URL transformation without requiring SDK.
 * Works for URLs containing `/upload/`.
 */
export function buildResponsiveImageUrl(inputUrl: string, preset: ImagePreset): string {
  const url = String(inputUrl ?? "").trim();
  if (!isCloudinaryUrl(url)) return url;
  const t = PRESET_TRANSFORM[preset];
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx < 0) return url;
  const head = url.slice(0, idx + marker.length);
  const tail = url.slice(idx + marker.length);
  // If already has transformations (contains a slash before version/public id), still prepend ours.
  return `${head}${t}/${tail}`;
}

