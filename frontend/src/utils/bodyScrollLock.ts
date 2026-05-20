import { useEffect } from "react";

/**
 * Ref-counted body scroll lock for overlays (drawer, sheet, modal).
 * iOS Telegram WebView: position:fixed + saved scrollY prevents background bleed-through.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyLeft = "";
let savedBodyRight = "";
let savedBodyWidth = "";
let savedHtmlOverflow = "";

function scrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth;
}

function applyLock(): void {
  savedScrollY = window.scrollY;
  const body = document.body;
  const html = document.documentElement;

  savedBodyOverflow = body.style.overflow;
  savedBodyPaddingRight = body.style.paddingRight;
  savedBodyPosition = body.style.position;
  savedBodyTop = body.style.top;
  savedBodyLeft = body.style.left;
  savedBodyRight = body.style.right;
  savedBodyWidth = body.style.width;
  savedHtmlOverflow = html.style.overflow;

  const sbw = scrollbarWidth();
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  html.style.overflow = "hidden";
  if (sbw > 0) {
    body.style.paddingRight = `${sbw}px`;
  }
}

function applyUnlock(): void {
  const body = document.body;
  const html = document.documentElement;

  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.left = savedBodyLeft;
  body.style.right = savedBodyRight;
  body.style.width = savedBodyWidth;
  body.style.overflow = savedBodyOverflow;
  body.style.paddingRight = savedBodyPaddingRight;
  html.style.overflow = savedHtmlOverflow;

  window.scrollTo(0, savedScrollY);
}

/** Lock body scroll. Returns unlock function — must be called on unmount/close. */
export function lockBodyScroll(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    applyLock();
  }
  return unlockBodyScroll;
}

function unlockBodyScroll(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    applyUnlock();
  }
}

/** Lock body scroll while `active` is true. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
