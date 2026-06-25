import type { ProviderDeliveryStatus } from "../../types/providerDeliveryTypes.js";

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

export type DeliveryAuditActor =
  | "SYSTEM"
  | "WEBHOOK"
  | "RECOVERY"
  | "MERCHANT"
  | "PLATFORM_OPERATOR";

export type DeliveryTimelineRecord = {
  id: number;
  providerDeliveryId: number;
  orderId: number;
  businessId: number;
  provider: string;
  kind: DeliveryTimelineKind;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  actor: DeliveryAuditActor;
  createdAt: Date;
};

export type DeliveryAuditRecord = {
  id: number;
  providerDeliveryId: number | null;
  orderId: number | null;
  businessId: number | null;
  provider: string | null;
  actor: DeliveryAuditActor;
  actorId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
};

export type AppendTimelineInput = {
  providerDeliveryId: number;
  orderId: number;
  businessId: number;
  provider: string;
  kind: DeliveryTimelineKind;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: DeliveryAuditActor;
};

export type AppendAuditInput = {
  providerDeliveryId?: number | null;
  orderId?: number | null;
  businessId?: number | null;
  provider?: string | null;
  actor: DeliveryAuditActor;
  actorId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
};

export type DeliverySearchFilters = {
  claimId?: string;
  orderId?: number;
  businessId?: number;
  customerName?: string;
  phone?: string;
  provider?: string;
  status?: ProviderDeliveryStatus;
  recoveryStatus?: "none" | "recovering" | "recovery_required";
  dateFrom?: Date;
  dateTo?: Date;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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
  actor: DeliveryAuditActor;
};

export type AnalyticsPeriod = "daily" | "weekly" | "monthly";

export const TIMELINE_KIND_FOR_STATUS: Partial<
  Record<ProviderDeliveryStatus, DeliveryTimelineKind>
> = {
  SEARCHING_COURIER: "STATUS_CHANGED",
  COURIER_ASSIGNED: "COURIER_ASSIGNED",
  COURIER_AT_PICKUP: "COURIER_ARRIVED",
  PICKED_UP: "PICKED_UP",
  DELIVERING: "DELIVERING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
  RECOVERY_REQUIRED: "RECOVERY_STARTED",
};
