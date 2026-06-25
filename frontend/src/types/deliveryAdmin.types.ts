export type ProviderDeliveryStatus =
  | "NEW"
  | "CREATED"
  | "ACCEPTED"
  | "SEARCHING_COURIER"
  | "COURIER_ASSIGNED"
  | "COURIER_AT_PICKUP"
  | "PICKED_UP"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "RECOVERY_REQUIRED";

export type DeliveryAnalyticsPeriod = "daily" | "weekly" | "monthly";

export type DeliverySearchResultItem = {
  deliveryId: number;
  orderId: number;
  orderNumber: string | null;
  merchantId: number;
  merchantName: string;
  customerName: string;
  phoneMasked: string;
  provider: string;
  providerClaimId: string | null;
  status: ProviderDeliveryStatus;
  recoveryRetryCount: number;
  inRecovery: boolean;
  createdAt: string;
  providerUpdatedAt: string | null;
  price?: number | null;
  etaMinutes?: number | null;
};

export type DeliverySearchResult = {
  items: DeliverySearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MerchantDeliveryDashboard = {
  active: number;
  searching: number;
  assigned: number;
  delivering: number;
  completedToday: number;
  cancelledToday: number;
  failedToday: number;
  averageEtaMinutes: number | null;
  averageDeliveryPrice: number | null;
};

export type OperatorDeliveryDashboard = {
  activeDeliveries: number;
  deliveriesByProvider: Record<string, number>;
  recoveryQueue: number;
  failedDeliveries: number;
  averageEtaMinutes: number | null;
  averageDeliveryDurationMinutes: number | null;
  averageProviderResponseTimeMs: number | null;
  averageCourierAssignmentMinutes: number | null;
  completionPercent: number;
  cancellationPercent: number;
  recoveryPercent: number;
};

export type DeliveryAnalyticsReport = {
  period: DeliveryAnalyticsPeriod;
  since: string;
  deliveryDurationMinutes: { avg: number | null; count: number };
  courierAssignmentMinutes: { avg: number | null; count: number };
  providerLatency: { refreshEvents: number; webhookEvents: number };
  webhookLatency: { estimatedAvgMs: number | null };
  recoveryCount: number;
  retryCount: number;
  failureReasons: Record<string, number>;
};

export type DeliveryTimelineKind =
  | "ORDER_CREATED"
  | "PAYMENT_CONFIRMED"
  | "OFFER_CALCULATED"
  | "CLAIM_CREATED"
  | "CLAIM_ACCEPTED"
  | "STATUS_CHANGED"
  | "COURIER_ASSIGNED"
  | "COURIER_ARRIVED"
  | "PICKED_UP"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "RECOVERY_STARTED"
  | "RECOVERY_RETRY"
  | "RECOVERY_RESOLVED"
  | "MANUAL_REFRESH"
  | "MANUAL_RETRY"
  | "FORCE_REFRESH"
  | "WEBHOOK_RECEIVED";

export type DeliveryUiEvent = {
  id: string;
  orderId: number;
  deliveryId: number;
  provider: string;
  kind: DeliveryTimelineKind;
  title: string;
  detail: string | null;
  status: ProviderDeliveryStatus | null;
  occurredAt: string;
  actor: string;
};

export type OperationsCapabilityMatrix = {
  refresh: boolean;
  tracking: boolean;
  cancel: boolean;
  returnDelivery: boolean;
  partialRefund: boolean;
  schedule: boolean;
  retryRecovery: boolean;
  forceRefresh: boolean;
};

export type DeliveryDetailsView = {
  delivery: {
    id: number;
    status: string;
    providerStatus: string | null;
    provider: string;
    providerClaimId: string | null;
    providerOfferId: string;
    price: number | null;
    currency: string | null;
    etaMinutes: number | null;
    trackingUrl: string | null;
    courierName: string | null;
    vehicleNumber: string | null;
    providerUpdatedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  merchant: { id: number; name: string; slug: string | null };
  customer: {
    name: string;
    phoneMasked: string;
    orderId: number;
    orderNumber: string | null;
  };
  order: {
    id: number;
    status: string;
    total: number;
    deliveryFee: number;
    createdAt: string;
  };
  recovery: {
    retryCount: number;
    nextRetryAt: string | null;
    lastError: string | null;
    inRecoveryQueue: boolean;
  };
  tracking: {
    hasCourier: boolean;
    hasEta: boolean;
    hasTrackingUrl: boolean;
  };
  timeline: {
    id: number;
    kind: DeliveryTimelineKind;
    title: string;
    detail: string | null;
    createdAt: string;
    actor: string;
  }[];
  audit: {
    id: number;
    action: string;
    actor: string;
    actorId: string | null;
    createdAt: string;
    details: Record<string, unknown> | null;
  }[];
  actions: {
    canRefresh: boolean;
    canRetryRecovery: boolean;
    canForceRefresh: boolean;
    providerPortalUrl: string | null;
    capabilities: OperationsCapabilityMatrix;
    copy: {
      claimId: string | null;
      orderId: number;
      merchantId: number;
    };
  };
};

export type DeliverySearchFilters = {
  q?: string;
  claimId?: string;
  orderId?: string;
  merchantId?: string;
  customerName?: string;
  phone?: string;
  provider?: string;
  status?: ProviderDeliveryStatus | "";
  recoveryStatus?: "none" | "recovering" | "recovery_required" | "";
  dateFrom?: string;
  dateTo?: string;
};

export type MerchantDeliveryProviderPolicy = {
  version: 1;
  enabled: boolean;
  strategy: "CHEAPEST" | "FASTEST" | "BEST_HEALTH" | "MERCHANT_PRIORITY" | "CUSTOM";
  preferredProviders: string[];
  preferredProvider: string | null;
  maxPriceSom: number | null;
  maxEtaMinutes: number | null;
  allowFallback: boolean;
  allowAutoSwitch: boolean;
  autoSelection: boolean;
};

export type DeliveryProviderPublic = {
  providerId: string;
  displayName: string;
  capabilities: Record<string, boolean>;
  health: {
    state: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
    successRate: number;
    failureRate: number;
    averageResponseTimeMs: number;
    timeoutPercent: number;
    recoveryPercent: number;
    webhookPercent: number;
    rateLimit429Percent: number;
    unavailable503Percent: number;
  };
  averageEtaMinutes: number | null;
  averagePrice: number | null;
  available: boolean;
};

export type DeliveryAdminMode = "merchant" | "operator";
