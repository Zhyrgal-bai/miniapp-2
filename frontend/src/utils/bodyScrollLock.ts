import { useEffect } from "react";

/** Primary Mini App scroll container (see app-shell.css). */
const SCROLL_ROOT_SELECTOR = ".sf-root.sf-app";
const LOCK_CLASS = "sf-scroll-locked";

const SCROLLABLE_OVERLAY_SELECTOR = [
  ".app-drawer__scroll",
  ".app-header__account-scroll",
  ".app-header__sheet",
  ".admin-modal__body",
  ".sf-support-temu__scroll",
  ".sf-support-sheet",
  ".sf-support-sheet__list",
  ".checkout-form-scroll",
  ".merchant-register__scroll",
  ".archa-overlay__scroll",
  ".sf-profile-sheet__scroll",
  ".sf-tg-modal",
  ".px-related-rail",
  ".table-booking-sheet__body",
].join(", ");

let lockCount = 0;
let savedScrollY = 0;
let savedScrollRoot: HTMLElement | null = null;
let touchBlocker: ((e: TouchEvent) => void) | null = null;

function resolveScrollRoot(): HTMLElement {
  const appRoot = document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
  if (appRoot) return appRoot;
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function readScrollY(root: HTMLElement): number {
  if (root === document.documentElement || root === document.body) {
    return window.scrollY;
  }
  return root.scrollTop;
}

function writeScrollY(root: HTMLElement, y: number): void {
  if (root === document.documentElement || root === document.body) {
    window.scrollTo(0, y);
    return;
  }
  root.scrollTop = y;
}

function clearLegacyBodyLockStyles(): void {
  const body = document.body;
  const html = document.documentElement;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  body.style.paddingRight = "";
  html.style.overflow = "";
}

function isInsideScrollableOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(SCROLLABLE_OVERLAY_SELECTOR));
}

function applyLock(): void {
  clearLegacyBodyLockStyles();

  const root = resolveScrollRoot();
  savedScrollRoot = root;
  savedScrollY = readScrollY(root);
  root.classList.add(LOCK_CLASS);

  touchBlocker = (e: TouchEvent) => {
    if (isInsideScrollableOverlay(e.target)) return;
    e.preventDefault();
  };
  document.addEventListener("touchmove", touchBlocker, { passive: false });
}

function applyUnlock(): void {
  const root = savedScrollRoot ?? resolveScrollRoot();
  root.classList.remove(LOCK_CLASS);
  writeScrollY(root, savedScrollY);
  savedScrollRoot = null;

  if (touchBlocker) {
    document.removeEventListener("touchmove", touchBlocker);
    touchBlocker = null;
  }

  clearLegacyBodyLockStyles();
}

/** Force-clear any stuck lock (e.g. after returning from Finik or TMA resume). */
export function resetBodyScrollLock(): void {
  lockCount = 0;
  document.querySelectorAll(`.${LOCK_CLASS}`).forEach((el) => {
    el.classList.remove(LOCK_CLASS);
  });
  if (touchBlocker) {
    document.removeEventListener("touchmove", touchBlocker);
    touchBlocker = null;
  }
  clearLegacyBodyLockStyles();
}

/** Lock app scroll root. Returns unlock function — must be called on unmount/close. */
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

/** Lock scroll while `active` is true. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
