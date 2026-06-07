/** Sync + state guard against double POST /orders (C2). */
export function isCheckoutSubmitBlocked(
  submitLock: boolean,
  submitting: boolean,
): boolean {
  return submitLock || submitting;
}
