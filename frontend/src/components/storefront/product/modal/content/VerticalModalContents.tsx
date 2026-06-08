import type { Product } from "../../../../../types";
import {
  ProductExperienceScreen,
  type ProductExperienceScreenProps,
} from "../../ProductExperienceScreen";

type BaseProps = Omit<
  ProductExperienceScreenProps,
  "quickView" | "heroFacts" | "noticeText" | "addLabelOverride" | "layoutId"
> & { product: Product };

function productAttrs(product: Product): Record<string, unknown> {
  if (
    product.attributes != null &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes)
  ) {
    return product.attributes as Record<string, unknown>;
  }
  return {};
}

function pickString(
  attrs: Record<string, unknown>,
  key: string,
): string | null {
  const value = attrs[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function withQuickView(
  props: BaseProps,
  options: {
    heroFacts?: Array<string | null>;
    noticeText?: string | null;
    addLabelOverride?: string | null;
    layoutId: ProductExperienceScreenProps["layoutId"];
  },
): React.ReactElement {
  const heroFacts = (options.heroFacts ?? []).filter(
    (x): x is string => typeof x === "string" && x.trim() !== "",
  );
  return (
    <ProductExperienceScreen
      {...props}
      quickView
      heroFacts={heroFacts}
      noticeText={options.noticeText ?? null}
      addLabelOverride={options.addLabelOverride ?? null}
      layoutId={options.layoutId}
    />
  );
}

export function GenericProductModalContent(props: BaseProps): React.ReactElement {
  return withQuickView(props, { layoutId: "generic" });
}

export function ClothingProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "size"),
    pickString(attrs, "color"),
    props.product.sizes?.length ? `${props.product.sizes.length} размеров` : null,
  ];
  return withQuickView(props, {
    layoutId: "clothing",
    heroFacts: facts,
    noticeText: "Размерная таблица доступна в описании товара.",
    addLabelOverride: "Добавить в корзину",
  });
}

export function FlowersProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "deliveryDate"),
    pickString(attrs, "bouquetCount"),
    pickString(attrs, "packaging"),
  ];
  return withQuickView(props, {
    layoutId: "flowers",
    heroFacts: facts,
    noticeText:
      "Добавьте открытку и пожелание в блоке опций заказа перед добавлением в корзину.",
    addLabelOverride: "Отправить подарок",
  });
}

export function CoffeeProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "volume"),
    pickString(attrs, "drinkType"),
    pickString(attrs, "hotOrCold"),
  ];
  return withQuickView(props, {
    layoutId: "coffee",
    heroFacts: facts,
    noticeText: "Настройте сахар и молоко в опциях заказа.",
    addLabelOverride: "Добавить в заказ",
  });
}

export function FastfoodProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "combo"),
    pickString(attrs, "spicy"),
    pickString(attrs, "addons"),
  ];
  return withQuickView(props, {
    layoutId: "fastfood",
    heroFacts: facts,
    noticeText: "Выберите соусы и добавки перед подтверждением.",
    addLabelOverride: "Добавить в заказ",
  });
}

export function ElectronicsProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "brand"),
    pickString(attrs, "memory"),
    typeof props.product.totalAvailable === "number"
      ? props.product.totalAvailable > 0
        ? "В наличии"
        : "Нет в наличии"
      : null,
  ];
  return withQuickView(props, {
    layoutId: "electronics",
    heroFacts: facts,
    noticeText: "Проверьте характеристики, гарантию и комплектацию в описании.",
    addLabelOverride: "Добавить в корзину",
  });
}

export function AutopartsProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "oem"),
    pickString(attrs, "compatibility"),
    pickString(attrs, "vin"),
  ];
  return withQuickView(props, {
    layoutId: "autoparts",
    heroFacts: facts,
    noticeText:
      "Для точного подбора укажите VIN и проверьте совместимость в опциях заказа.",
    addLabelOverride: "Добавить к заказу",
  });
}

export function CosmeticsProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "shade"),
    pickString(attrs, "volume"),
    pickString(attrs, "skinType"),
  ];
  return withQuickView(props, {
    layoutId: "cosmetics",
    heroFacts: facts,
    noticeText:
      "Состав и способ применения указаны в описании — проверьте перед покупкой.",
    addLabelOverride: "Добавить в корзину",
  });
}

export function FurnitureProductModalContent(props: BaseProps): React.ReactElement {
  const attrs = productAttrs(props.product);
  const facts = [
    pickString(attrs, "dimensions"),
    pickString(attrs, "material"),
    pickString(attrs, "color"),
  ];
  return withQuickView(props, {
    layoutId: "furniture",
    heroFacts: facts,
    noticeText: "Уточните условия доставки и сборки перед оформлением.",
    addLabelOverride: "Добавить в корзину",
  });
}

