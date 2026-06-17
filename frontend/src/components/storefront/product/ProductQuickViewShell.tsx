import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import { useTheme } from "../../../context/ThemeContext";
import { applyThemeVars } from "../theme/applyThemeVars";
import "./ProductQuickViewShell.css";

export type ProductQuickViewShellProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated Ambient glow removed — kept for call-site compat */
  ambientImageSrc?: string | null;
  maxWidth?: "sm" | "md" | "lg";
  children: ReactNode;
};

function portalRoot(): HTMLElement {
  if (typeof document === "undefined") return null as unknown as HTMLElement;
  return document.body;
}

export function ProductQuickViewShell({
  open,
  onClose,
  children,
}: ProductQuickViewShellProps): React.ReactElement | null {
  useBodyScrollLock(open);
  const { theme } = useTheme();
  const themeStyle = useMemo(() => applyThemeVars(theme), [theme]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sf-product-quick-view-host"
      data-sf-product-quick-view="open"
      style={themeStyle as CSSProperties}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Товар"
        className="sf-product-quick-view sf-product-quick-view--fullscreen sf-product-quick-view--enter"
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
      </div>
    </div>,
    portalRoot(),
  );
}
