/** Storefront visual experience id — maps 1:1 to existing BusinessType niches. */
export type StorefrontVerticalExperience =
  | "clothing"
  | "flowers"
  | "coffee"
  | "fastfood"
  | "electronics"
  | "autoparts"
  | "cosmetics"
  | "furniture"
  | "default";

const VERTICAL_SET = new Set<string>([
  "clothing",
  "flowers",
  "coffee",
  "fastfood",
  "electronics",
  "autoparts",
  "cosmetics",
  "furniture",
]);

export function storefrontVerticalExperience(
  businessType: string | null | undefined,
): StorefrontVerticalExperience {
  const t = String(businessType ?? "").trim().toLowerCase();
  if (VERTICAL_SET.has(t)) return t as StorefrontVerticalExperience;
  return "default";
}

export function hasVerticalStorefrontExperience(
  businessType: string | null | undefined,
): boolean {
  return storefrontVerticalExperience(businessType) !== "default";
}

/** Catalog card CTA when merchant has not set addToCartLabel. */
export function verticalCatalogCtaLabel(
  businessType: string | null | undefined,
  opts: { outOfStock: boolean; needsVariantPicker: boolean },
): string {
  if (opts.outOfStock) return "Нет в наличии";
  if (opts.needsVariantPicker) {
    const v = storefrontVerticalExperience(businessType);
    if (v === "clothing") return "Смотреть";
    if (v === "flowers") return "Выбрать букет";
    if (v === "coffee" || v === "fastfood") return "Заказать";
    if (v === "electronics") return "Смотреть характеристики";
    if (v === "autoparts") return "Проверить совместимость";
    if (v === "cosmetics") return "Смотреть состав";
    if (v === "furniture") return "Смотреть детали";
    return "Выбрать";
  }
  const v = storefrontVerticalExperience(businessType);
  if (v === "clothing") return "В корзину";
  if (v === "flowers") return "Заказать букет";
  if (v === "coffee") return "Заказать";
  if (v === "fastfood") return "В заказ";
  if (v === "electronics") return "В корзину";
  if (v === "autoparts") return "Подобрать";
  if (v === "cosmetics") return "В корзину";
  if (v === "furniture") return "В корзину";
  return "В корзину";
}

/** PDP sticky CTA when merchant has not set addToCartLabel. */
export function verticalPdpAddLabel(businessType: string | null | undefined): string {
  const v = storefrontVerticalExperience(businessType);
  if (v === "clothing") return "Добавить в корзину";
  if (v === "flowers") return "Отправить подарок";
  if (v === "coffee") return "Добавить в заказ";
  if (v === "fastfood") return "Добавить в заказ";
  if (v === "electronics") return "Добавить в корзину";
  if (v === "autoparts") return "Добавить к заказу";
  if (v === "cosmetics") return "Добавить в корзину";
  if (v === "furniture") return "Добавить в корзину";
  return "Добавить в корзину";
}
