import type { ReactNode } from "react";
import { ProductQuickViewShell } from "../ProductQuickViewShell";
import "./ProductModalFrameV2.css";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
};

/** Phase 12: centered modal v2 host frame. */
export function ProductModalFrameV2({
  open,
  onClose,
  children,
  maxWidth = "md",
}: Props): React.ReactElement | null {
  if (!open) return null;
  return (
    <ProductQuickViewShell open={open} onClose={onClose} maxWidth={maxWidth}>
      <div className={`sf-product-modal-v2__body sf-product-modal-v2__body--${maxWidth}`}>{children}</div>
    </ProductQuickViewShell>
  );
}

