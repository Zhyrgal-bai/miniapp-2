import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

export function FlowersProductCard(props: Props): React.ReactElement {
  return <ProductCard {...props} />;
}

