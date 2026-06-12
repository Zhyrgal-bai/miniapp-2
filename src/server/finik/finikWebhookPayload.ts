/**
 * Парсинг inbound Finik webhook (legacy + official acquiring).
 */

export type ParsedFinikWebhookPayload = {
  /** Основной id для логов / replay. */
  paymentId: string;
  /** Все непустые id из тела — для поиска Order.paymentId. */
  paymentIdCandidates: readonly string[];
  status: string;
  amount: number | null;
  externalId: string | null;
  orderIdFromBody: number | null;
};

function pickNonEmptyString(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v === "" || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function nestedDataRecord(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = body.Data ?? body.data;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/** Извлекает payment refs в порядке приоритета Finik official + legacy. */
export function extractFinikWebhookPaymentIds(
  body: Record<string, unknown>,
): string[] {
  const data = nestedDataRecord(body);
  return uniqueStrings([
    pickNonEmptyString(body.paymentId),
    pickNonEmptyString(body.payment_id),
    pickNonEmptyString(body.PaymentId),
    pickNonEmptyString(body.transactionId),
    pickNonEmptyString(body.transaction_id),
    pickNonEmptyString(body.id),
    pickNonEmptyString(body.orderId),
    pickNonEmptyString(body.order_id),
    ...(data
      ? [
          pickNonEmptyString(data.paymentId),
          pickNonEmptyString(data.payment_id),
          pickNonEmptyString(data.PaymentId),
          pickNonEmptyString(data.transactionId),
          pickNonEmptyString(data.transaction_id),
        ]
      : []),
  ]);
}

function pickExternalId(body: Record<string, unknown>): string | null {
  const data = nestedDataRecord(body);
  const raw =
    body.external_id ??
    body.externalId ??
    data?.external_id ??
    data?.externalId;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s !== "" ? s : null;
}

function pickWebhookStatus(body: Record<string, unknown>): string {
  const data = nestedDataRecord(body);
  const statusRaw =
    body.status ??
    body.payment_status ??
    body.state ??
    body.Status ??
    data?.status ??
    data?.payment_status ??
    data?.state;
  return String(statusRaw ?? "").toLowerCase();
}

function pickWebhookAmount(body: Record<string, unknown>): number | null {
  const data = nestedDataRecord(body);
  const amountRaw =
    body.amount ??
    body.total ??
    body.sum ??
    body.payment_amount ??
    body.Amount ??
    data?.amount ??
    data?.Amount ??
    data?.total;
  if (amountRaw == null) return null;
  const n = Number(amountRaw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseFinikWebhookPayload(
  body: Record<string, unknown>,
): ParsedFinikWebhookPayload {
  const paymentIdCandidates = extractFinikWebhookPaymentIds(body);
  const orderIdBodyRaw = body.order_id ?? body.orderId;

  let orderIdFromBody: number | null = null;
  if (orderIdBodyRaw != null) {
    const n = Number(orderIdBodyRaw);
    if (Number.isFinite(n) && n > 0) orderIdFromBody = Math.floor(n);
  }

  return {
    paymentId: paymentIdCandidates[0] ?? "",
    paymentIdCandidates,
    status: pickWebhookStatus(body),
    amount: pickWebhookAmount(body),
    externalId: pickExternalId(body),
    orderIdFromBody,
  };
}
