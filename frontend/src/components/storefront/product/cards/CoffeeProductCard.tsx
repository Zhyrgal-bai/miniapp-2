import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function CoffeeProductCard(props: Props): React.ReactElement {
  const attrs =
    props.product.attributes != null &&
    typeof props.product.attributes === "object" &&
    !Array.isArray(props.product.attributes)
      ? (props.product.attributes as Record<string, unknown>)
      : {};

  const volume =
    typeof attrs.volume === "string" && attrs.volume.trim() !== ""
      ? attrs.volume.trim()
      : null;
  const drinkType =
    typeof attrs.drinkType === "string" && attrs.drinkType.trim() !== ""
      ? attrs.drinkType.trim()
      : null;

  const textCfg =
    props.textConfig != null &&
    typeof props.textConfig === "object" &&
    !Array.isArray(props.textConfig)
      ? (props.textConfig as Record<string, unknown>)
      : {};

  const chips = [volume, drinkType].filter(Boolean).join(" • ");
  const prevHint = typeof textCfg.cardHint === "string" ? textCfg.cardHint : "";
  const nextTextConfig =
    chips !== ""
      ? { ...textCfg, cardHint: chips, addToCartLabel: "Заказать" }
      : { ...textCfg, cardHint: prevHint || "Кофе на выбор", addToCartLabel: "Заказать" };

  return <ProductCard {...props} textConfig={nextTextConfig} />;
}

