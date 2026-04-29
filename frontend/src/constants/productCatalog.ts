export const PRODUCT_SIZES = ["S", "M", "L", "XL"] as const;
export type ProductSizeLabel = (typeof PRODUCT_SIZES)[number];
