import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function ClothingProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const size =
    typeof attrs.size === "string" && attrs.size.trim() !== ""
      ? attrs.size.trim()
      : null;
  const color =
    typeof attrs.color === "string" && attrs.color.trim() !== ""
      ? attrs.color.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [size, color].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "В корзину" }
      : { ...textCfg, addToCartLabel: "В корзину" };

  return <ProductCard {...props} textConfig={nextTextConfig} />;
}

