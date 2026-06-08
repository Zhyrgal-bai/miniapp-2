import type { Product } from "../../../../types";
import {
  resolveModalBehavior,
  resolveModalRendererId,
} from "../../../../storefront/templates/templateRegistry";
import { ProductModalFrameV2 } from "../modal/ProductModalFrameV2";
import { ClothingPdpContent } from "../modal/content/ClothingPdpContent";
import { FlowersPdpContent } from "../modal/content/FlowersPdpContent";
import { FastfoodPdpContent } from "../modal/content/FastfoodPdpContent";
import { CoffeePdpContent } from "../modal/content/CoffeePdpContent";
import { ElectronicsPdpContent } from "../modal/content/ElectronicsPdpContent";
import { AutopartsPdpContent } from "../modal/content/AutopartsPdpContent";
import { CosmeticsPdpContent } from "../modal/content/CosmeticsPdpContent";
import { FurniturePdpContent } from "../modal/content/FurniturePdpContent";
import {
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
      if (vertical === "clothing") return <ClothingPdpContent {...commonProps} />;
      if (vertical === "flowers") return <FlowersPdpContent {...commonProps} />;
      if (vertical === "coffee") return <CoffeePdpContent {...commonProps} />;
      if (vertical === "fastfood") return <FastfoodPdpContent {...commonProps} />;
      if (vertical === "electronics") return <ElectronicsPdpContent {...commonProps} />;
      if (vertical === "autoparts") return <AutopartsPdpContent {...commonProps} />;
      if (vertical === "cosmetics") return <CosmeticsPdpContent {...commonProps} />;
      if (vertical === "furniture") return <FurniturePdpContent {...commonProps} />;
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

