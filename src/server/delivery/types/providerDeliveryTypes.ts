export type ProviderDeliveryProviderId = string;

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

export const ACTIVE_RECOVERY_STATUSES: readonly ProviderDeliveryStatus[] = [
  "CREATED",
  "SEARCHING_COURIER",
  "COURIER_ASSIGNED",
  "COURIER_AT_PICKUP",
  "PICKED_UP",
  "DELIVERING",
] as const;

export type ProviderDeliveryRecord = {
  id: number;
  orderId: number;
  businessId: number;
  buyerUserId: number | null;
  provider: ProviderDeliveryProviderId;
  providerClaimId: string | null;
  providerOfferId: string;
  price: number | null;
  currency: string | null;
  status: ProviderDeliveryStatus;
  providerStatus: string | null;
  providerUpdatedAt: Date | null;
  courierName: string | null;
  courierPhone: string | null;
  vehicleNumber: string | null;
  etaMinutes: number | null;
  trackingUrl: string | null;
  courierLat: number | null;
  courierLng: number | null;
  lastWebhookKey: string | null;
  providerPayload: unknown | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  recoveryRetryCount: number;
  recoveryNextRetryAt: Date | null;
  recoveryLastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderDeliveryStatusEventRecord = {
  id: number;
  providerDeliveryId: number;
  providerStatus: string;
  internalStatus: ProviderDeliveryStatus;
  providerUpdatedAt: Date;
  webhookKey: string;
  courierName: string | null;
  vehicleNumber: string | null;
  etaMinutes: number | null;
  createdAt: Date;
};

export type CreateProviderDeliveryInput = {
  orderId: number;
  businessId: number;
  buyerUserId: number | null;
  provider: ProviderDeliveryProviderId;
  providerOfferId: string;
  price?: number | null;
  currency?: string | null;
  status?: ProviderDeliveryStatus;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
};

export type UpdateProviderDeliveryInput = {
  status?: ProviderDeliveryStatus;
  providerClaimId?: string | null;
  providerPayload?: unknown | null;
  price?: number | null;
  currency?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
};

export type UpdateTrackingSnapshotInput = {
  status: ProviderDeliveryStatus;
  providerStatus: string;
  providerUpdatedAt: Date;
  lastWebhookKey: string;
  courierName?: string | null;
  courierPhone?: string | null;
  vehicleNumber?: string | null;
  etaMinutes?: number | null;
  trackingUrl?: string | null;
  courierLat?: number | null;
  courierLng?: number | null;
};

export type AppendStatusEventInput = {
  providerDeliveryId: number;
  providerStatus: string;
  internalStatus: ProviderDeliveryStatus;
  providerUpdatedAt: Date;
  webhookKey: string;
  courierName?: string | null;
  vehicleNumber?: string | null;
  etaMinutes?: number | null;
};

export type AppendStatusEventResult =
  | { ok: true; event: ProviderDeliveryStatusEventRecord; duplicate: false }
  | { ok: true; duplicate: true }
  | { ok: false; error: string };

export type UpdateRecoveryStateInput = {
  recoveryRetryCount?: number;
  recoveryNextRetryAt?: Date | null;
  recoveryLastError?: string | null;
  status?: ProviderDeliveryStatus;
};

export type CustomerDeliveryTrackingView = {
  provider: ProviderDeliveryProviderId;
  status: ProviderDeliveryStatus;
  etaMinutes: number | null;
  courier: {
    name: string | null;
    vehicle: string | null;
  };
  trackingUrl: string | null;
  updatedAt: string | null;
};

export type MerchantDeliveryTrackingView = CustomerDeliveryTrackingView & {
  providerStatus: string | null;
  providerClaimId: string | null;
  price: number | null;
  currency: string | null;
  deliveryStage: string | null;
  courier: {
    name: string | null;
    phone: string | null;
    vehicle: string | null;
  };
  createdAt: string;
};

export type ProviderDeliveryFailureCode =
  | "offer_not_found"
  | "offer_expired"
  | "merchant_not_found"
  | "merchant_unavailable"
  | "delivery_disabled"
  | "invalid_order"
  | "invalid_coordinates"
  | "provider_timeout"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "unknown_provider_error";
