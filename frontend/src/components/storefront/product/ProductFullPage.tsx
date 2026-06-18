import { useEffect } from "react";
import type { Product } from "../../../types";
import { resolveModalRendererId } from "../../../storefront/templates/templateRegistry";
import { ensureTelegramMobileUx } from "../../../utils/telegramWebAppBootstrap";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import { VerticalProductModalContent } from "./modal/content/VerticalModalContents";
import "./ProductFullPage.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  templateDescriptor?: Record<string, unknown> | null;
  modalV3Enabled?: boolean;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
};

/** Full-screen product page — replaces catalog instead of centered modal overlay. */
export function ProductFullPage({
  product,
  businessId,
  businessType,
  templateDescriptor,
  modalV3Enabled = true,
  catalogProducts,
  onClose,
  onSelectProduct,
}: Props): React.ReactElement {
  useBodyScrollLock(true);
  useEffect(() => {
    ensureTelegramMobileUx();
  }, [product.id]);

  const descriptorContext = {
    businessType: businessType ?? product.businessType,
    product,
    templateDescriptor: templateDescriptor ?? null,
  };
  const rendererId = resolveModalRendererId(descriptorContext);

  return (
    <div
      className="sf-product-page"
      role="dialog"
      aria-modal="true"
      aria-label="Товар"
      data-sf-product-page="1"
    >
      <button
        type="button"
        className="sf-product-page__close"
        aria-label="Закрыть"
        onClick={onClose}
      >
        ×
      </button>
      <div className="sf-product-page__body">
        <VerticalProductModalContent
          product={product}
          businessId={businessId}
          businessType={businessType ?? undefined}
          catalogProducts={catalogProducts}
          onClose={onClose}
          onSelectProduct={onSelectProduct}
          rendererId={rendererId}
          forceGeneric={!modalV3Enabled}
        />
      </div>
    </div>
  );
}
