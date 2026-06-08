import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function FlowersProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const deliveryDate =
    typeof attrs.deliveryDate === "string" && attrs.deliveryDate.trim() !== ""
      ? attrs.deliveryDate.trim()
      : null;
  const bouquetCount =
    typeof attrs.bouquetCount === "string" && attrs.bouquetCount.trim() !== ""
      ? attrs.bouquetCount.trim()
      : null;
  const packaging =
    typeof attrs.packaging === "string" && attrs.packaging.trim() !== ""
      ? attrs.packaging.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const cardHint = [bouquetCount, packaging, deliveryDate].filter(Boolean).join(" • ");
  const nextTextConfig =
    cardHint !== ""
      ? { ...textCfg, cardHint, addToCartLabel: "Заказать букет" }
      : { ...textCfg, addToCartLabel: "Заказать букет" };

  return <ProductCard {...props} textConfig={nextTextConfig} />;
}

