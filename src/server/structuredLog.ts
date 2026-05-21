type LogLevel = "warn" | "error" | "info";

type LogFields = Record<string, unknown> & {
  correlationId?: string;
};

/** Shared JSON log emitter (used by checkout step debug). */
export function emitStructuredLog(
  level: LogLevel,
  event: string,
  fields: LogFields,
): void {
  emit(level, event, fields);
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logCommerceEvent(fields: {
  phase:
    | "checkout_start"
    | "checkout_priced"
    | "order_created"
    | "stock_reserved"
    | "payment_session"
    | "payment_webhook"
    | "inventory_commit"
    | "support_action";
  businessId: number;
  orderId?: number;
  paymentId?: string;
  correlationId?: string;
  detail?: string;
}): void {
  emit("info", "commerce_event", fields);
}

export function logInventoryMismatch(fields: {
  businessId: number;
  productId: number;
  issues: unknown;
  correlationId?: string;
}): void {
  emit("warn", "inventory_mismatch", fields);
}

export function logInventoryHeal(fields: {
  businessId: number;
  productId: number;
  issueCount: number;
}): void {
  emit("info", "inventory_heal", fields);
}

export function logInventoryReserveFailed(fields: {
  businessId: number;
  orderId?: number;
  productId?: number;
  size?: string;
  color?: string;
  error: string;
  correlationId?: string;
}): void {
  emit("warn", "inventory_reserve_failed", fields);
}

export function logWebhookReject(fields: {
  provider: string;
  businessId?: number;
  reason: string;
  paymentId?: string;
  correlationId?: string;
}): void {
  emit("warn", "webhook_reject", fields);
}

export function logAuthReject(fields: {
  path: string;
  reason: string;
  ip?: string;
  correlationId?: string;
}): void {
  emit("warn", "auth_reject", fields);
}

export function logCheckoutReject(fields: {
  businessId: number;
  reason: string;
  userId?: number;
  correlationId?: string;
}): void {
  emit("warn", "checkout_reject", fields);
}

export function logPaymentFailure(fields: {
  businessId: number;
  orderId?: number;
  reason: string;
  paymentId?: string;
  finikStatus?: string;
  correlationId?: string;
}): void {
  emit("warn", "payment_failure", fields);
}

export function logWebhookProcessed(fields: {
  provider: string;
  businessId: number;
  orderId?: number;
  paymentId?: string;
  outcome: "success" | "duplicate" | "failed" | "ignored" | "replay";
  correlationId?: string;
}): void {
  emit("info", "webhook_processed", fields);
}

export function logStaleOrderReleased(fields: {
  count: number;
  maxAgeMs: number;
  businessId?: number;
}): void {
  emit("info", "stale_order_released", fields);
}
