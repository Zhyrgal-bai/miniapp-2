import { getTelegramWebApp } from "./telegram";

function applyTelegramViewportCssVars(): void {
  const tg = getTelegramWebApp() as
    | (TelegramWebApp & {
        viewportStableHeight?: number;
        viewportHeight?: number;
        onEvent?: (event: string, cb: () => void) => void;
      })
    | undefined;
  if (tg == null) return;

  const stable = tg.viewportStableHeight;
  const current = tg.viewportHeight;
  const h =
    typeof stable === "number" && stable > 0
      ? stable
      : typeof current === "number" && current > 0
        ? current
        : null;

  if (h != null) {
    document.documentElement.style.setProperty("--archa-viewport-h", `${h}px`);
  }

  const tgInsets = tg as TelegramWebApp & {
    contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
    safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  };

  const contentInset = tgInsets.contentSafeAreaInset;
  const safeInset = tgInsets.safeAreaInset;
  const insetTop =
    typeof contentInset?.top === "number" && contentInset.top > 0
      ? contentInset.top
      : typeof safeInset?.top === "number" && safeInset.top > 0
        ? safeInset.top
        : 0;
  const insetBottom =
    typeof contentInset?.bottom === "number" && contentInset.bottom > 0
      ? contentInset.bottom
      : typeof safeInset?.bottom === "number" && safeInset.bottom > 0
        ? safeInset.bottom
        : 0;

  document.documentElement.style.setProperty(
    "--tg-content-safe-area-top",
    `${insetTop}px`,
  );
  document.documentElement.style.setProperty(
    "--tg-content-safe-area-bottom",
    `${insetBottom}px`,
  );
}

/**
 * Telegram Mini App bootstrap — call once at app startup.
 * expand + disableVerticalSwipes reduce accidental Mini App close on swipe.
 */
export function bootstrapTelegramWebApp(): void {
  ensureTelegramMobileUx();
}

/** Re-apply TMA mobile settings (safe to call on route changes). */
export function ensureTelegramMobileUx(): void {
  const tg = getTelegramWebApp();
  if (tg == null) return;

  tg.ready();
  tg.expand?.();

  // Bot API 7.7+ — prevents swipe-down closing Mini App during vertical scroll
  tg.disableVerticalSwipes?.();

  tg.setHeaderColor?.("secondary_bg_color");
  tg.setBackgroundColor?.("bg_color");

  applyTelegramViewportCssVars();

  const tgExt = tg as TelegramWebApp & {
    onEvent?: (event: string, cb: () => void) => void;
  };
  const onViewport = () => applyTelegramViewportCssVars();
  tgExt.onEvent?.("viewportChanged", onViewport);
  // No offEvent in older clients — handler is idempotent
}

/** Open external payment / link inside Telegram when possible. */
export function openTelegramExternalLink(url: string): void {
  const trimmed = url.trim();
  if (trimmed === "") return;

  const tg = getTelegramWebApp();
  if (tg?.openLink) {
    tg.openLink(trimmed);
    return;
  }
  window.location.href = trimmed;
}
