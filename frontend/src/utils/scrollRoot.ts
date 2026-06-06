/** Primary Mini App scroll container (see app-shell.css). */
export const SCROLL_ROOT_SELECTOR = ".sf-root.sf-app[data-sf-scroll-root]";

export function getScrollRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
}

export function scrollRootToTop(behavior: ScrollBehavior = "auto"): void {
  const root = getScrollRoot();
  if (root) {
    root.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}

export function readScrollRootY(): number {
  const root = getScrollRoot();
  if (root) return root.scrollTop;
  return window.scrollY;
}

export function writeScrollRootY(y: number): void {
  const root = getScrollRoot();
  if (root) {
    root.scrollTop = y;
    return;
  }
  window.scrollTo(0, y);
}
