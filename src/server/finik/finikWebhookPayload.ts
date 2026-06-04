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

/** Извлекает payment refs в порядке приоритета Finik official + legacy. */
export function extractFinikWebhookPaymentIds(
  body: Record<string, unknown>,
): string[] {
  return uniqueStrings([
    pickNonEmptyString(body.paymentId),
    pickNonEmptyString(body.payment_id),
    pickNonEmptyString(body.transactionId),
    pickNonEmptyString(body.transaction_id),
    pickNonEmptyString(body.id),
    pickNonEmptyString(body.orderId),
    pickNonEmptyString(body.order_id),
  ]);
}

export function parseFinikWebhookPayload(
  body: Record<string, unknown>,
): ParsedFinikWebhookPayload {
  const paymentIdCandidates = extractFinikWebhookPaymentIds(body);
  const statusRaw = body.status ?? body.payment_status ?? body.state;
  const amountRaw = body.amount ?? body.total ?? body.sum ?? body.payment_amount;
  const externalRaw = body.external_id ?? body.externalId;
  const orderIdBodyRaw = body.order_id ?? body.orderId;

  let orderIdFromBody: number | null = null;
  if (orderIdBodyRaw != null) {
    const n = Number(orderIdBodyRaw);
    if (Number.isFinite(n) && n > 0) orderIdFromBody = Math.floor(n);
  }

  let amount: number | null = null;
  if (amountRaw != null) {
    const n = Number(amountRaw);
    if (Number.isFinite(n)) amount = Math.round(n);
  }

  return {
    paymentId: paymentIdCandidates[0] ?? "",
    paymentIdCandidates,
    status: String(statusRaw ?? "").toLowerCase(),
    amount,
    externalId:
      externalRaw != null && String(externalRaw).trim() !== ""
        ? String(externalRaw).trim()
        : null,
    orderIdFromBody,
  };
}
