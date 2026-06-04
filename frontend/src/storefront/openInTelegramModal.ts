export const OPEN_IN_TELEGRAM_MODAL_EVENT = "sf:openInTelegramModal";

export function openOpenInTelegramModal(
  telegramOpenUrl?: string | null,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_IN_TELEGRAM_MODAL_EVENT, {
      detail: { telegramOpenUrl: telegramOpenUrl ?? null },
    }),
  );
}
