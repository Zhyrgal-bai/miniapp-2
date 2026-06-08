/** Retail Product Card System V1 — layout tokens (storefront catalog only). */

export const RETAIL_CARD_ACTION_MIN_PX = 44;
export const RETAIL_CARD_TITLE_LINES = 2;
/** Fixed meta block height — prevents grid row height jumps. */
export const RETAIL_CARD_META_MIN_PX = 52;

export type RetailCardImageRatio = "square" | "portrait" | "landscape";

export function retailCardAspectRatio(ratio: RetailCardImageRatio): string {
  switch (ratio) {
    case "portrait":
      return "4 / 5";
    case "landscape":
      return "16 / 10";
    default:
      return "1 / 1";
  }
}

/** Format price for card scan (no thousand separators — keeps line stable). */
export function formatRetailCardPrice(amount: number): string {
  return `${amount} сом`;
}
