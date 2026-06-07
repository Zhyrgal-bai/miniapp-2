/** После редиректа на Finik — опрос заказа до подтверждения оплаты. */
export const SF_PENDING_FINIK_ORDER_KEY = "sf_pending_finik_order";

export type PendingFinikOrderPayload = {
  orderId: number;
  businessId: number;
  startedAt: number;
  paymentUrl?: string;
};

export function setPendingFinikOrder(
  input: Pick<PendingFinikOrderPayload, "orderId" | "businessId"> & {
    startedAt?: number;
    paymentUrl?: string;
  }
): void {
  try {
    const payload: PendingFinikOrderPayload = {
      orderId: input.orderId,
      businessId: input.businessId,
      startedAt: input.startedAt ?? Date.now(),
      ...(typeof input.paymentUrl === "string" && input.paymentUrl.trim() !== ""
        ? { paymentUrl: input.paymentUrl.trim() }
        : {}),
    };
    localStorage.setItem(SF_PENDING_FINIK_ORDER_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readPendingFinikOrder(): PendingFinikOrderPayload | null {
  try {
    const raw = localStorage.getItem(SF_PENDING_FINIK_ORDER_KEY);
    if (raw == null || raw.trim() === "") return null;
    const j = JSON.parse(raw) as unknown;
    if (j == null || typeof j !== "object" || Array.isArray(j)) return null;
    const o = j as Record<string, unknown>;
    const orderId = Number(o.orderId);
    const businessId = Number(o.businessId);
    const startedAt = Number(o.startedAt);
    if (!Number.isInteger(orderId) || orderId <= 0) return null;
    if (!Number.isInteger(businessId) || businessId <= 0) return null;
    if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
    const paymentUrl =
      typeof o.paymentUrl === "string" && o.paymentUrl.trim() !== ""
        ? o.paymentUrl.trim()
        : undefined;
    return { orderId, businessId, startedAt, ...(paymentUrl ? { paymentUrl } : {}) };
  } catch {
    return null;
  }
}

export function clearPendingFinikOrder(): void {
  try {
    localStorage.removeItem(SF_PENDING_FINIK_ORDER_KEY);
  } catch {
    /* */
  }
}

/** Keep checkout submit locked while Finik payment is in flight (C3). */
export function shouldReleaseCheckoutSubmitOnResume(): boolean {
  return readPendingFinikOrder() == null;
}

/** Restore checkout lock after remount / return from Finik (M5). */
export function hasPendingFinikCheckout(): boolean {
  return readPendingFinikOrder() != null;
}
