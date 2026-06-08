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
type HostProps = Props & { templateDescriptor?: Record<string, unknown> | null };

/** Phase 12 host: picks vertical card renderer from template registry. */
export function ProductCardHost(props: HostProps): React.ReactElement {
  const { templateDescriptor, ...cardProps } = props;
  const rendererId = resolveCardRendererId({
    businessType: cardProps.businessType ?? cardProps.product.businessType,
    product: cardProps.product,
    templateDescriptor: templateDescriptor ?? null,
  });

  if (rendererId === "clothing") return <ClothingProductCard {...cardProps} />;
  if (rendererId === "flowers") return <FlowersProductCard {...cardProps} />;
  if (rendererId === "coffee") return <CoffeeProductCard {...cardProps} />;
  if (rendererId === "fastfood") return <FastfoodProductCard {...cardProps} />;
  if (rendererId === "electronics") return <ElectronicsProductCard {...cardProps} />;
  if (rendererId === "autoparts") return <AutopartsProductCard {...cardProps} />;
  if (rendererId === "cosmetics") return <CosmeticsProductCard {...cardProps} />;
  if (rendererId === "furniture") return <FurnitureProductCard {...cardProps} />;
  return <ProductCard {...cardProps} />;
}

