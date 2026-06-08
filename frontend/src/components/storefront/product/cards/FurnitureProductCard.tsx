import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function FurnitureProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const dimensions =
    typeof attrs.dimensions === "string" && attrs.dimensions.trim() !== ""
      ? attrs.dimensions.trim()
      : null;
  const material =
    typeof attrs.material === "string" && attrs.material.trim() !== ""
      ? attrs.material.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [dimensions, material].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "В корзину" }
      : { ...textCfg, addToCartLabel: "В корзину" };

  const nextCardConfig = {
    ...(props.cardConfig ?? {}),
    imageFit: "cover",
    imageRatio: "landscape",
  };

  return <ProductCard {...props} cardConfig={nextCardConfig} textConfig={nextTextConfig} />;
}

