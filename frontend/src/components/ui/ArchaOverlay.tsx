import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "../../utils/bodyScrollLock";
import "./archaOverlay.css";

export type ArchaOverlayLayer = "default" | "header" | "support" | "platform";

export type ArchaOverlayProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  variant?: "sheet" | "modal" | "platform-modal";
  portalTarget?: HTMLElement | null;
  panelClassName?: string;
  scrollClassName?: string;
  footerClassName?: string;
  enableDrag?: boolean;
  layer?: ArchaOverlayLayer;
};

const SHEET_SPRING = { type: "spring" as const, damping: 32, stiffness: 380 };
const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

function defaultPortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("sf-theme-portal-root") ?? document.body;
}

function layerClass(prefix: string, layer: ArchaOverlayLayer): string {
  return layer === "default" ? "" : `${prefix}--layer-${layer}`;
}

export function ArchaOverlay({
  open,
  onClose,
  ariaLabel,
  children,
  header,
  footer,
  variant = "sheet",
  portalTarget,
  panelClassName = "",
  scrollClassName = "",
  footerClassName = "",
  enableDrag = variant === "sheet",
  layer = variant === "platform-modal" ? "platform" : "default",
}: ArchaOverlayProps): React.ReactElement | null {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const root =
    portalTarget ??
    (variant === "platform-modal"
      ? typeof document !== "undefined"
        ? document.body
        : null
      : defaultPortalRoot());
  if (root == null) return null;

  const panelClass =
    variant === "platform-modal"
      ? panelClassName
      : [
          "archa-overlay__panel",
          variant === "sheet"
            ? "archa-overlay__panel--sheet"
            : "archa-overlay__panel--modal",
          layerClass("archa-overlay__panel", layer),
          panelClassName,
        ]
          .filter(Boolean)
          .join(" ");

  const scrollClass = ["archa-overlay__scroll", scrollClassName].filter(Boolean).join(" ");
  const footerClass = ["archa-overlay__footer", footerClassName].filter(Boolean).join(" ");

  if (variant === "platform-modal") {
    return createPortal(
      <AnimatePresence>
        {open ? (
          <motion.div
            key="archa-platform-backdrop"
            className={[
              "archa-overlay__backdrop",
              "archa-overlay__backdrop--platform",
              "mp-settings-backdrop",
              layerClass("archa-overlay__backdrop", layer),
            ]
              .filter(Boolean)
              .join(" ")}
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          >
            <motion.div
              key="archa-platform-panel"
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              className={panelClass}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      root,
    );
  }

  const panelMotion = (
    <motion.div
      key="archa-overlay-panel"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={panelClass}
      initial={variant === "sheet" ? { y: "104%" } : { opacity: 0, scale: 0.96, y: 12 }}
      animate={variant === "sheet" ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
      exit={variant === "sheet" ? { y: "104%" } : { opacity: 0, scale: 0.98, y: 8 }}
      transition={variant === "sheet" ? SHEET_SPRING : { duration: 0.22, ease: MODAL_EASE }}
      drag={enableDrag ? "y" : false}
      dragConstraints={enableDrag ? { top: 0, bottom: 0 } : undefined}
      dragElastic={enableDrag ? { top: 0, bottom: 0.42 } : undefined}
      onDragEnd={
        enableDrag
          ? (_, info) => {
              if (info.offset.y > 96 || info.velocity.y > 520) onClose();
            }
          : undefined
      }
    >
      {variant === "sheet" ? <div className="archa-overlay__handle" aria-hidden /> : null}
      {header ? <div className="archa-overlay__header">{header}</div> : null}
      <div className={scrollClass}>{children}</div>
      {footer ? <div className={footerClass}>{footer}</div> : null}
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="archa-overlay-backdrop"
            className={[
              "archa-overlay__backdrop",
              layerClass("archa-overlay__backdrop", layer),
            ]
              .filter(Boolean)
              .join(" ")}
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          {panelMotion}
        </>
      ) : null}
    </AnimatePresence>,
    root,
  );
}
