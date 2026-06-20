/** Shared Finik payment polling — single timeout across banner + app lifecycle. */
export const FINIK_PAYMENT_POLL_MS = 2000;
export const FINIK_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

export const FINIK_PAYMENT_PAID_EVENT = "sf:finikPaymentPaid";
export const FINIK_PAYMENT_RELEASED_EVENT = "sf:finikPaymentReleased";

export type FinikPaymentPaidDetail = {
  orderId: number;
  businessId: number;
};

export function dispatchFinikPaymentPaid(detail: FinikPaymentPaidDetail): void {
  window.dispatchEvent(
    new CustomEvent(FINIK_PAYMENT_PAID_EVENT, { detail }),
  );
}
