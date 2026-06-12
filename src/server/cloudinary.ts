import { v2 as cloudinary } from "cloudinary";
import { isCloudinaryConfigured, uploadImageBuffer } from "../media/cloudinary.js";

export { isCloudinaryConfigured };

/** Чек оплаты: изображение или PDF → Cloudinary. Новые — в business_{id}/receipts. */
export async function uploadReceiptToCloudinary(
  buffer: Buffer,
  mimetype: string,
  businessId?: number,
): Promise<{ secureUrl: string; receiptType: "pdf" | "image" }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  const isPdf =
    mimetype === "application/pdf" || mimetype === "application/x-pdf";
  const folder =
    businessId != null && Number.isInteger(businessId) && businessId > 0
      ? `business_${businessId}/receipts`
      : "telegram-miniapp/receipts";
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isPdf ? "raw" : "image",
        secure: true,
      },
      (err, res) => {
        if (err) return reject(err);
        return resolve(res);
      },
    );
    stream.end(buffer);
  });
  return {
    secureUrl: result.secure_url,
    receiptType: isPdf ? "pdf" : "image",
  };
}

export { cloudinary };

// Legacy helper kept for compatibility; uploads to business_0/storefront by default.
export async function uploadImageToCloudinary(
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  const out = await uploadImageBuffer({
    businessId: 0,
    kind: "storefront",
    buffer,
    mimetype,
  });
  return out.url;
}
