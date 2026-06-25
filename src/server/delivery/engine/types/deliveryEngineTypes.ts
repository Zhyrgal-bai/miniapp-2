export type DeliveryProviderCapabilityKey =
  | "calculatePrice"
  | "createClaim"
  | "acceptClaim"
  | "cancelClaim"
  | "tracking"
  | "webhook"
  | "eta"
  | "liveLocation"
  | "returnDelivery"
  | "cashOnDelivery"
  | "partialRefund"
  | "scheduledDelivery";

export type DeliveryProviderCapabilities = Record<DeliveryProviderCapabilityKey, boolean>;

export const EMPTY_CAPABILITIES: DeliveryProviderCapabilities = {
  calculatePrice: false,
  createClaim: false,
  acceptClaim: false,
  cancelClaim: false,
  tracking: false,
  webhook: false,
  eta: false,
  liveLocation: false,
  returnDelivery: false,
  cashOnDelivery: false,
  partialRefund: false,
  scheduledDelivery: false,
};

export type ProviderHealthState = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

export type ProviderSelectionStrategy =
  | "CHEAPEST"
  | "FASTEST"
  | "BEST_HEALTH"
  | "MERCHANT_PRIORITY"
  | "CUSTOM";

export type ProviderHealthMetrics = {
  providerId: string;
  state: ProviderHealthState;
  successRate: number;
  failureRate: number;
  averageResponseTimeMs: number | null;
  timeoutPercent: number;
  recoveryPercent: number;
  webhookPercent: number;
  rateLimit429Percent: number;
  serverError503Percent: number;
  totalRequests: number;
};

export type ProviderOfferCandidate = {
  providerId: string;
  price: number;
  currency: string;
  etaMinutes: number | null;
  providerOfferId: string;
  expiresAt: string | null;
  payload: string;
  score?: number;
};

export type ProviderScoreWeights = {
  price: number;
  eta: number;
  health: number;
  successRate: number;
  merchantPriority: number;
  availability: number;
};

export const DEFAULT_SCORE_WEIGHTS: ProviderScoreWeights = {
  price: 0.35,
  eta: 0.25,
  health: 0.2,
  successRate: 0.1,
  merchantPriority: 0.05,
  availability: 0.05,
};

export type ProviderPublicView = {
  providerId: string;
  displayName: string;
  capabilities: DeliveryProviderCapabilities;
  health: ProviderHealthMetrics;
  averageEtaMinutes: number | null;
  averagePrice: number | null;
  status: ProviderHealthState;
  available: boolean;
};

export type OperationsCapabilityMatrix = {
  refresh: boolean;
  tracking: boolean;
  cancel: boolean;
  returnDelivery: boolean;
  refund: boolean;
  schedule: boolean;
  forceRefresh: boolean;
  retryRecovery: boolean;
  openProvider: boolean;
};
