import { v2 as cloudinary } from "cloudinary";
import { isCloudinaryConfigured, uploadImageBuffer } from "../media/cloudinary.js";

export { isCloudinaryConfigured };

/** Чек оплаты: изображение или PDF → Cloudinary, папка receipts. */
export async function uploadReceiptToCloudinary(
  buffer: Buffer,
  mimetype: string
): Promise<{ secureUrl: string; receiptType: "pdf" | "image" }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }
  const isPdf =
    mimetype === "application/pdf" || mimetype === "application/x-pdf";
  const mime = isPdf ? "application/pdf" : mimetype || "image/jpeg";
  const b64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "telegram-miniapp/receipts",
    resource_type: isPdf ? "raw" : "image",
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
