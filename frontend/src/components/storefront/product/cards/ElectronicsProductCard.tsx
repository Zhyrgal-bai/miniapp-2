import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function ElectronicsProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const brand =
    typeof attrs.brand === "string" && attrs.brand.trim() !== ""
      ? attrs.brand.trim()
      : null;
  const memory =
    typeof attrs.memory === "string" && attrs.memory.trim() !== ""
      ? attrs.memory.trim()
      : null;
  const stockLabel = typeof props.product.totalAvailable === "number"
    ? props.product.totalAvailable > 0
      ? "В наличии"
      : "Нет в наличии"
    : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [brand, memory, stockLabel].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "В корзину" }
      : { ...textCfg, addToCartLabel: "В корзину" };

  const nextCardConfig = {
    ...(props.cardConfig ?? {}),
    imageFit: "contain",
    imageRatio: "square",
  };

  return <ProductCard {...props} cardConfig={nextCardConfig} textConfig={nextTextConfig} />;
}

