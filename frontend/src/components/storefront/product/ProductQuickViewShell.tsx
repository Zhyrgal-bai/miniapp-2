import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import "./ProductQuickViewShell.css";

export type ProductQuickViewShellProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated Ambient glow removed — kept for call-site compat */
  ambientImageSrc?: string | null;
  maxWidth?: "sm" | "md" | "lg";
  children: ReactNode;
};

function portalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("sf-theme-portal-root") ?? document.body;
}

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;
const MODAL_MAX_WIDTH: Record<NonNullable<ProductQuickViewShellProps["maxWidth"]>, string> = {
  sm: "640px",
  md: "780px",
  lg: "960px",
};

export function ProductQuickViewShell({
  open,
  onClose,
  maxWidth = "md",
  children,
}: ProductQuickViewShellProps): React.ReactElement | null {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const root = portalRoot();
  if (root == null) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="px-qv-backdrop"
            type="button"
            className="sf-product-quick-view__backdrop"
            aria-label="Закрыть"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            key="px-qv-positioner"
            className="sf-product-quick-view__positioner"
            style={
              {
                ["--sf-modal-max-width" as string]: MODAL_MAX_WIDTH[maxWidth],
              } as CSSProperties
            }
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Товар"
              className="sf-product-quick-view"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.28, ease: MODAL_EASE }}
            >
              <button
                type="button"
                className="sf-product-quick-view__close"
                aria-label="Закрыть"
                onClick={onClose}
              >
                ×
              </button>
              <div className="sf-product-quick-view__scroll">{children}</div>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    root,
  );
}
