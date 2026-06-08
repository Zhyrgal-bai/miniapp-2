import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { resolveCardRendererId } from "../../../../storefront/templates/templateRegistry";
import { ClothingProductCard } from "../cards/ClothingProductCard";
import { FlowersProductCard } from "../cards/FlowersProductCard";
import { CoffeeProductCard } from "../cards/CoffeeProductCard";
import { FastfoodProductCard } from "../cards/FastfoodProductCard";
import { ElectronicsProductCard } from "../cards/ElectronicsProductCard";
import { AutopartsProductCard } from "../cards/AutopartsProductCard";
import { CosmeticsProductCard } from "../cards/CosmeticsProductCard";
import { FurnitureProductCard } from "../cards/FurnitureProductCard";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

/** Phase 12 host: picks vertical card renderer from template registry. */
export function ProductCardHost(props: Props): React.ReactElement {
  const rendererId = resolveCardRendererId({
    businessType: props.businessType ?? props.product.businessType,
    product: props.product,
  });

  if (rendererId === "clothing") return <ClothingProductCard {...props} />;
  if (rendererId === "flowers") return <FlowersProductCard {...props} />;
  if (rendererId === "coffee") return <CoffeeProductCard {...props} />;
  if (rendererId === "fastfood") return <FastfoodProductCard {...props} />;
  if (rendererId === "electronics") return <ElectronicsProductCard {...props} />;
  if (rendererId === "autoparts") return <AutopartsProductCard {...props} />;
  if (rendererId === "cosmetics") return <CosmeticsProductCard {...props} />;
  if (rendererId === "furniture") return <FurnitureProductCard {...props} />;
  return <ProductCard {...props} />;
}

