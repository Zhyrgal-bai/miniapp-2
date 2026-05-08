export type CloudinaryImagePreset = "thumbnail" | "storefront" | "hero" | "preview";

const PRESET_TRANSFORM: Record<CloudinaryImagePreset, string> = {
  thumbnail: "f_auto,q_auto,w_300",
  storefront: "f_auto,q_auto,w_1200",
  hero: "f_auto,q_auto,w_1600",
  preview: "f_auto,q_auto,w_800",
};

function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\//i.test(url);
}

export function buildCloudinaryResponsiveUrl(inputUrl: string, preset: CloudinaryImagePreset): string {
  const url = String(inputUrl ?? "").trim();
  if (!url) return "";
  if (!isCloudinaryUrl(url)) return url;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx < 0) return url;
  const t = PRESET_TRANSFORM[preset];
  return `${url.slice(0, idx + marker.length)}${t}/${url.slice(idx + marker.length)}`;
}

