import type { MediaEntityKind, UploadResult } from "./types.js";
import { uploadImageBuffer } from "./cloudinary.js";

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(params: {
  mimetype: string | undefined;
  sizeBytes: number | undefined;
}): { ok: true; mimetype: string } | { ok: false; error: string } {
  const mt = (params.mimetype ?? "").trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mt)) {
    return { ok: false, error: "Недопустимый формат. Разрешены: jpeg/png/webp" };
  }
  const size = typeof params.sizeBytes === "number" ? params.sizeBytes : 0;
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "Пустой файл" };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Файл слишком большой (лимит 5MB)" };
  }
  return { ok: true, mimetype: mt };
}

export async function uploadTenantImage(params: {
  businessId: number;
  kind: Exclude<MediaEntityKind, "receipts">;
  buffer: Buffer;
  mimetype: string;
}): Promise<UploadResult> {
  return uploadImageBuffer(params);
}

