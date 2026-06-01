/** Режим create payment (Phase 3 scaffold). Production default: legacy. */
export type FinikCreateApiMode = "legacy" | "official" | "auto";

export type FinikCreateApiModeUsed = "legacy" | "official" | "mock";

export type FinikCreateFlow =
  | "storefront_order"
  | "saas_subscription"
  | "platform_subscription"
  | "reservation_deposit";

export type FinikBusinessTenant = {
  kind: "business";
  businessId: number;
  finikApiKey: string | null;
  finikAccountId: string | null;
  finikSecret: string | null;
};

export type FinikPlatformTenant = {
  kind: "platform";
  apiKey: string;
  secret: string;
};

export type FinikCreateTenant = FinikBusinessTenant | FinikPlatformTenant;

export type FinikCreateContext = {
  flow: FinikCreateFlow;
  tenant: FinikCreateTenant;
  amount: number;
  currency: string;
  /** Legacy body `order_id`. */
  orderId: string;
  /** Correlation для webhook (Phase 4). */
  externalId: string;
  callbackUrl: string;
  returnUrl: string;
  correlationId?: string;
  idempotencyKey?: string;
};

export type FinikCreateSuccess = {
  ok: true;
  paymentId: string;
  paymentUrl: string;
  apiMode: FinikCreateApiModeUsed;
};

export type FinikCreateFailure = {
  ok: false;
  error: string;
  code?: string;
  retryable?: boolean;
  apiMode?: FinikCreateApiModeUsed;
};

export type FinikCreateResult = FinikCreateSuccess | FinikCreateFailure;

/** Порт создания платежа Finik (legacy / official / mock). */
export interface FinikCreatePort {
  readonly apiMode: FinikCreateApiModeUsed;
  createPaymentSession(ctx: FinikCreateContext): Promise<FinikCreateResult>;
}
