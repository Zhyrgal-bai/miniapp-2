export type FeaturedPromo = {
  code: string;
  discount: number;
  remainingUses: number;
};

export function formatFeaturedPromoLine(promo: FeaturedPromo): string {
  const code = String(promo.code ?? "").trim();
  if (code === "") return "";
  return `Промокод ${code}`;
}
