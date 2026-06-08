import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function AutopartsProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const oem =
    typeof attrs.oem === "string" && attrs.oem.trim() !== ""
      ? attrs.oem.trim()
      : null;
  const compatibility =
    typeof attrs.compatibility === "string" && attrs.compatibility.trim() !== ""
      ? attrs.compatibility.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [oem, compatibility].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "Подобрать" }
      : { ...textCfg, addToCartLabel: "Подобрать" };

  const nextCardConfig = {
    ...(props.cardConfig ?? {}),
    imageFit: "contain",
    imageRatio: "square",
  };

  return <ProductCard {...props} cardConfig={nextCardConfig} textConfig={nextTextConfig} />;
}

