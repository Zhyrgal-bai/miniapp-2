import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import { isTelegramMiniAppEnv } from "../../../utils/telegramSession";
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
const DESKTOP_MODAL_MQ = "(min-width: 1024px) and (pointer: fine)";
const MODAL_MAX_WIDTH: Record<NonNullable<ProductQuickViewShellProps["maxWidth"]>, string> = {
  sm: "640px",
  md: "780px",
  lg: "960px",
};

function subscribeFullscreenModal(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const desktopMq = window.matchMedia(DESKTOP_MODAL_MQ);
  const coarseMq = window.matchMedia("(pointer: coarse)");
  const narrowMq = window.matchMedia("(max-width: 1023px)");
  desktopMq.addEventListener("change", onStoreChange);
  coarseMq.addEventListener("change", onStoreChange);
  narrowMq.addEventListener("change", onStoreChange);
  return () => {
    desktopMq.removeEventListener("change", onStoreChange);
    coarseMq.removeEventListener("change", onStoreChange);
    narrowMq.removeEventListener("change", onStoreChange);
  };
}

function shouldUseFullscreenProductModal(): boolean {
  if (typeof window === "undefined") return false;
  if (isTelegramMiniAppEnv()) return true;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  if (window.matchMedia("(max-width: 1023px)").matches) return true;
  return !window.matchMedia(DESKTOP_MODAL_MQ).matches;
}

function useFullscreenProductModal(): boolean {
  return useSyncExternalStore(
    subscribeFullscreenModal,
    shouldUseFullscreenProductModal,
    () => true,
  );
}

export function ProductQuickViewShell({
  open,
  onClose,
  maxWidth = "md",
  children,
}: ProductQuickViewShellProps): React.ReactElement | null {
  useBodyScrollLock(open);
  const fullscreen = useFullscreenProductModal();

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

  if (fullscreen) {
    return createPortal(
      <AnimatePresence>
        {open ? (
          <motion.div
            key="px-qv-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label="Товар"
            className="sf-product-quick-view sf-product-quick-view--fullscreen"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
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
        ) : null}
      </AnimatePresence>,
      root,
    );
  }

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
