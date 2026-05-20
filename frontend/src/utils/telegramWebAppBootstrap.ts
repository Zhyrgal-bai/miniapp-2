import { getTelegramWebApp } from "./telegram";

/**
 * Telegram Mini App bootstrap — call once at app startup.
 * expand + disableVerticalSwipes reduce accidental Mini App close on swipe.
 */
export function bootstrapTelegramWebApp(): void {
  const tg = getTelegramWebApp();
  if (tg == null) return;

  tg.ready();
  tg.expand?.();

  // Bot API 7.7+ — optional; no-op on older clients
  tg.disableVerticalSwipes?.();

  // Prefer theme-aware header if available
  tg.setHeaderColor?.("secondary_bg_color");
  tg.setBackgroundColor?.("bg_color");
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
