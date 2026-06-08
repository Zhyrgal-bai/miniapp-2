import type { Product } from "../../../../types";
import {
  resolveModalBehavior,
  resolveModalRendererId,
} from "../../../../storefront/templates/templateRegistry";
import { ProductModalFrameV2 } from "../modal/ProductModalFrameV2";
import {
  AutopartsProductModalContent,
  ClothingProductModalContent,
  CoffeeProductModalContent,
  CosmeticsProductModalContent,
  ElectronicsProductModalContent,
  FastfoodProductModalContent,
  FlowersProductModalContent,
  FurnitureProductModalContent,
  GenericProductModalContent,
} from "../modal/content/VerticalModalContents";

type Props = {
  open: boolean;
  product: Product | null;
  businessId: number;
  businessType?: string;
  templateDescriptor?: Record<string, unknown> | null;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
};

/** Phase 12 host: modal v2 + content strategy from template registry. */
export function ProductModalHost({
  open,
  product,
  businessId,
  businessType,
  templateDescriptor,
  catalogProducts,
  onClose,
  onSelectProduct,
}: Props): React.ReactElement | null {
  if (!open || product == null) return null;
  const descriptorContext = {
    businessType: businessType ?? product.businessType,
    product,
    templateDescriptor: templateDescriptor ?? null,
  };
  const rendererId = resolveModalRendererId({
    ...descriptorContext,
  });
  const modalBehavior = resolveModalBehavior(descriptorContext);
  const commonProps = {
    product,
    businessId,
    businessType: businessType ?? undefined,
    catalogProducts,
    onClose,
    onSelectProduct,
  };
  if (rendererId === "product-experience-v2" || rendererId === "generic-v2") {
    const vertical = String(
      businessType ?? product.businessType ?? "",
    ).trim().toLowerCase();
    const content = (() => {
      if (rendererId === "generic-v2") return <GenericProductModalContent {...commonProps} />;
      if (vertical === "clothing") return <ClothingProductModalContent {...commonProps} />;
      if (vertical === "flowers") return <FlowersProductModalContent {...commonProps} />;
      if (vertical === "coffee") return <CoffeeProductModalContent {...commonProps} />;
      if (vertical === "fastfood") return <FastfoodProductModalContent {...commonProps} />;
      if (vertical === "electronics") return <ElectronicsProductModalContent {...commonProps} />;
      if (vertical === "autoparts") return <AutopartsProductModalContent {...commonProps} />;
      if (vertical === "cosmetics") return <CosmeticsProductModalContent {...commonProps} />;
      if (vertical === "furniture") return <FurnitureProductModalContent {...commonProps} />;
      return <GenericProductModalContent {...commonProps} />;
    })();
    return (
      <ProductModalFrameV2
        open={open}
        onClose={onClose}
        maxWidth={modalBehavior.maxWidth}
      >
        {content}
      </ProductModalFrameV2>
    );
  }
  return null;
}

