import { useEffect } from "react";

/**
 * Ref-counted body scroll lock for overlays (drawer, sheet, modal).
 * Prevents race when multiple overlays open/close in different order.
 */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function scrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth;
}

/** Lock body scroll. Returns unlock function — must be called on unmount/close. */
export function lockBodyScroll(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    const sbw = scrollbarWidth();
    document.body.style.overflow = "hidden";
    if (sbw > 0) {
      document.body.style.paddingRight = `${sbw}px`;
    }
  }
  return unlockBodyScroll;
}

function unlockBodyScroll(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

/** Lock body scroll while `active` is true. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
