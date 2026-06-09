import type { Product } from "../../../../types";
import {
  resolveModalBehavior,
  resolveModalRendererId,
} from "../../../../storefront/templates/templateRegistry";
import { ProductModalFrameV2 } from "../modal/ProductModalFrameV2";
import {
  VerticalProductModalContent,
} from "../modal/content/VerticalModalContents";

type Props = {
  open: boolean;
  product: Product | null;
  businessId: number;
  businessType?: string;
  templateDescriptor?: Record<string, unknown> | null;
  modalV3Enabled?: boolean;
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
  modalV3Enabled = true,
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
    return (
      <ProductModalFrameV2
        open={open}
        onClose={onClose}
        maxWidth={modalBehavior.maxWidth}
      >
        <VerticalProductModalContent
          {...commonProps}
          rendererId={rendererId}
          forceGeneric={!modalV3Enabled}
        />
      </ProductModalFrameV2>
    );
  }
  return null;
}

