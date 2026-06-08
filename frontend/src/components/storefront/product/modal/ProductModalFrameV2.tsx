import type { ReactNode } from "react";
import { ProductQuickViewShell } from "../ProductQuickViewShell";
import "./ProductModalFrameV2.css";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Phase 12: centered modal v2 host frame. */
export function ProductModalFrameV2({
  open,
  onClose,
  children,
}: Props): React.ReactElement | null {
  if (!open) return null;
  return (
    <ProductQuickViewShell open={open} onClose={onClose}>
      <div className="sf-product-modal-v2__body">{children}</div>
    </ProductQuickViewShell>
  );
}

