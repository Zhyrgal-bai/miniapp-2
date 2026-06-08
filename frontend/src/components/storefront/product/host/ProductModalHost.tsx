import type { Product } from "../../../../types";
import { resolveModalRendererId } from "../../../../storefront/templates/templateRegistry";
import { ProductExperienceScreen } from "../ProductExperienceScreen";
import { ProductModalFrameV2 } from "../modal/ProductModalFrameV2";

type Props = {
  open: boolean;
  product: Product | null;
  businessId: number;
  businessType?: string;
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
  catalogProducts,
  onClose,
  onSelectProduct,
}: Props): React.ReactElement | null {
  if (!open || product == null) return null;
  const rendererId = resolveModalRendererId({
    businessType: businessType ?? product.businessType,
    product,
  });
  if (rendererId === "product-experience-v2" || rendererId === "generic-v2") {
    return (
      <ProductModalFrameV2 open={open} onClose={onClose}>
        <ProductExperienceScreen
          product={product}
          businessId={businessId}
          businessType={businessType ?? undefined}
          catalogProducts={catalogProducts}
          onClose={onClose}
          onSelectProduct={onSelectProduct}
          quickView
        />
      </ProductModalFrameV2>
    );
  }
  return null;
}

