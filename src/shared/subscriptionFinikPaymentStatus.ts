/** DB statuses for `SubscriptionFinikPayment.status`. */
export type SubscriptionFinikPaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export const SUBSCRIPTION_FINIK_PAYMENT_STATUSES: readonly SubscriptionFinikPaymentStatus[] =
  ["pending", "completed", "failed", "cancelled"];

/** Success webhook may extend subscription only from `pending`. */
export function canClaimSubscriptionFinikPaymentStatus(status: string): boolean {
  return status === "pending";
}
