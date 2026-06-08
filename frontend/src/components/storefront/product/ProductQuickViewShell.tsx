import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import "./ProductQuickViewShell.css";

export type ProductQuickViewShellProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated Ambient glow removed — kept for call-site compat */
  ambientImageSrc?: string | null;
  children: ReactNode;
};

function portalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("sf-theme-portal-root") ?? document.body;
}

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

export function ProductQuickViewShell({
  open,
  onClose,
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
            key="px-qv-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Товар"
            className="sf-product-quick-view"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: MODAL_EASE }}
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
        </>
      ) : null}
    </AnimatePresence>,
    root,
  );
}
