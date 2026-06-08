import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function CosmeticsProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const shade =
    typeof attrs.shade === "string" && attrs.shade.trim() !== ""
      ? attrs.shade.trim()
      : null;
  const volume =
    typeof attrs.volume === "string" && attrs.volume.trim() !== ""
      ? attrs.volume.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [shade, volume].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "В корзину" }
      : { ...textCfg, addToCartLabel: "В корзину" };

  const nextCardConfig = {
    ...(props.cardConfig ?? {}),
    imageFit: "cover",
    imageRatio: "portrait",
  };

  return <ProductCard {...props} cardConfig={nextCardConfig} textConfig={nextTextConfig} />;
}

