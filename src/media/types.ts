export type MediaEntityKind =
  | "products"
  | "storefront"
  | "blocks"
  | "avatars"
  | "receipts"
  | "support";

export type CloudinaryImageAsset = {
  url: string; // secure_url
  publicId: string;
  width: number;
  height: number;
  format?: string;
};

export type ProductImageMeta = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format?: string;
};

export type UploadResult = CloudinaryImageAsset;

