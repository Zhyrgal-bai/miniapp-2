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
    ...(res.format != null ? { format: String(res.format) } : {}),
  };
}

export type ListedCloudinaryAsset = {
  publicId: string;
  bytes?: number;
  format?: string;
  createdAt?: string;
};

/** List Cloudinary assets under business_{id}/ prefix (paginated). */
export async function listTenantAssets(
  businessId: number,
  kind?: string,
): Promise<ListedCloudinaryAsset[]> {
  assertCloudinaryConfigured();
  const prefix =
    kind != null && kind.trim() !== ""
      ? businessFolder(businessId, kind as Exclude<MediaEntityKind, "receipts">)
      : `business_${businessId}/`;

  const out: ListedCloudinaryAsset[] = [];
  let nextCursor: string | undefined;

  do {
    const page = await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: 500,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });
    const resources = Array.isArray(page.resources) ? page.resources : [];
    for (const r of resources) {
      const publicId = typeof r.public_id === "string" ? r.public_id : "";
      if (!publicId) continue;
      out.push({
        publicId,
        bytes: typeof r.bytes === "number" ? r.bytes : undefined,
        format: typeof r.format === "string" ? r.format : undefined,
        createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
      });
    }
    nextCursor =
      typeof page.next_cursor === "string" && page.next_cursor !== ""
        ? page.next_cursor
        : undefined;
  } while (nextCursor);

  return out;
}

export async function deleteImage(publicId: string): Promise<void> {
  assertCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export { cloudinary };

