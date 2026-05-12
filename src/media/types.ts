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
};

export type UploadResult = CloudinaryImageAsset;

