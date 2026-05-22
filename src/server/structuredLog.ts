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

/** Temp debug: initData header present on privileged route. */
export function logAuthHeaderPresent(fields: {
  path: string;
  method: string;
  length: number;
}): void {
  emit("info", "auth_header_present", fields);
}

/** Temp debug: initData header missing on privileged route. */
export function logAuthHeaderMissing(fields: {
  path: string;
  method: string;
}): void {
  emit("warn", "auth_header_missing", fields);
}

/** Temp debug: privileged route rejected after auth check. */
export function logPrivilegedRouteReject(fields: {
  path: string;
  method: string;
  reason: string;
  status: number;
}): void {
  emit("warn", "privileged_route_reject", fields);
}

/** Temp debug: initData present but signature did not match any candidate token. */
export function logInitDataInvalid(fields: {
  path: string;
  method: string;
  tokensTried: number;
  hadStartParam: boolean;
  hadTenantHint: boolean;
  startParamBusinessId?: number | null;
  requestTenantBusinessId?: number | null;
}): void {
  emit("warn", "initData_invalid", fields);
}

/** Temp debug: business token candidate failed HMAC (wrong bot or decrypt empty). */
export function logTokenMismatch(fields: {
  path: string;
  method: string;
  source: string;
  businessId?: number;
  tokenPresent: boolean;
}): void {
  emit("info", "token_mismatch", fields);
}

/** Temp debug: business id hint but row missing or botToken empty. */
export function logBusinessNotFound(fields: {
  path: string;
  method: string;
  businessId: number;
  source: string;
  tokenPresent: boolean;
}): void {
  emit("warn", "business_not_found", fields);
}

/** Temp debug: initData has no start_param (menu-button opens). */
export function logStartParamMissing(fields: {
  path: string;
  method: string;
  requestTenantBusinessId?: number | null;
}): void {
  emit("info", "start_param_missing", fields);
}

/** Admin save: stale/unknown product.attributes keys removed before validation. */
export function logProductAttributesStripped(fields: {
  businessType: string;
  strippedKeys: string[];
  staleLegacyKeys: string[];
  businessId?: number;
  productId?: number;
}): void {
  emit("warn", "product_attributes_stripped", fields);
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
