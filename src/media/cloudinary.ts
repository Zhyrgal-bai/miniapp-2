import { v2 as cloudinary } from "cloudinary";
import type { MediaEntityKind, UploadResult } from "./types.js";

const cloudName =
  process.env.CLOUDINARY_CLOUD_NAME ??
  process.env.CLOUD_NAME ??
  "";
const apiKey =
  process.env.CLOUDINARY_API_KEY ??
  process.env.CLOUD_KEY ??
  "";
const apiSecret =
  process.env.CLOUDINARY_API_SECRET ??
  process.env.CLOUD_SECRET ??
  "";

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

export function assertCloudinaryConfigured(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary не настроен (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)",
    );
  }
}

export function businessFolder(businessId: number, kind: MediaEntityKind): string {
  const id = Number(businessId);
  const safe = Number.isInteger(id) && id > 0 ? id : 0;
  return `business_${safe}/${kind}`;
}

export async function uploadImageBuffer(params: {
  businessId: number;
  kind: Exclude<MediaEntityKind, "receipts">;
  buffer: Buffer;
  mimetype: string;
}): Promise<UploadResult> {
  assertCloudinaryConfigured();

  const res = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: businessFolder(params.businessId, params.kind),
        resource_type: "image",
        secure: true,
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      },
    );
    stream.end(params.buffer);
  });

  return {
    url: String(res.secure_url ?? ""),
    publicId: String(res.public_id ?? ""),
    width: Number(res.width ?? 0) || 0,
    height: Number(res.height ?? 0) || 0,
  };
}

export async function deleteImage(publicId: string): Promise<void> {
  assertCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export { cloudinary };

