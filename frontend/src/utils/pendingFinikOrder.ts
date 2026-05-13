/** После редиректа на Finik — опрос заказа до подтверждения оплаты. */
export const SF_PENDING_FINIK_ORDER_KEY = "sf_pending_finik_order";

export type PendingFinikOrderPayload = {
  orderId: number;
  businessId: number;
  startedAt: number;
};

export function setPendingFinikOrder(
  input: Pick<PendingFinikOrderPayload, "orderId" | "businessId"> & {
    startedAt?: number;
  }
): void {
  try {
    const payload: PendingFinikOrderPayload = {
      orderId: input.orderId,
      businessId: input.businessId,
      startedAt: input.startedAt ?? Date.now(),
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
    return { orderId, businessId, startedAt };
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
