import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import { AmbientImageGlow } from "./AmbientImageGlow";
import "./ProductQuickViewShell.css";

export type ProductQuickViewShellProps = {
  open: boolean;
  onClose: () => void;
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
  ambientImageSrc,
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
            style={{ x: "-50%", y: "-50%" }}
            initial={{ opacity: 0, scale: 0.92, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }}
            transition={{ duration: 0.28, ease: MODAL_EASE }}
          >
            <AmbientImageGlow
              src={ambientImageSrc}
              className="sf-ambient-glow--quick-view"
            />
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
