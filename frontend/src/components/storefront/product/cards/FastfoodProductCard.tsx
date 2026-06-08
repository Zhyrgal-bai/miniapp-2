import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function FastfoodProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const combo =
    typeof attrs.combo === "string" && attrs.combo.trim() !== ""
      ? attrs.combo.trim()
      : null;
  const spicy =
    typeof attrs.spicy === "string" && attrs.spicy.trim() !== ""
      ? attrs.spicy.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [combo, spicy].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "В заказ" }
      : { ...textCfg, addToCartLabel: "В заказ" };

  return <ProductCard {...props} textConfig={nextTextConfig} />;
}

