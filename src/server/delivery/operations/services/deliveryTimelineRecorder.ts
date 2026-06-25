import type { ProviderDeliveryStatus } from "../../types/providerDeliveryTypes.js";
import {
  createDeliveryTimelineRepository,
  type DeliveryTimelineRepository,
} from "../repositories/deliveryTimelineRepository.js";
import {
  createDeliveryAuditRepository,
  type DeliveryAuditRepository,
} from "../repositories/deliveryAuditRepository.js";
import type {
  AppendAuditInput,
  AppendTimelineInput,
  DeliveryAuditActor,
  DeliveryTimelineKind,
} from "../types/deliveryOperationsTypes.js";

export type DeliveryTimelineRecorderDeps = {
  timeline?: DeliveryTimelineRepository;
  audit?: DeliveryAuditRepository;
};

export function createDeliveryTimelineRecorder(deps: DeliveryTimelineRecorderDeps = {}) {
  const timeline = deps.timeline ?? createDeliveryTimelineRepository();
  const audit = deps.audit ?? createDeliveryAuditRepository();

  async function recordTimeline(input: AppendTimelineInput) {
    return timeline.append(input);
  }

  async function recordAudit(input: AppendAuditInput) {
    return audit.append(input);
  }

  async function recordStatusChange(input: {
    providerDeliveryId: number;
    orderId: number;
    businessId: number;
    provider: string;
    internalStatus: ProviderDeliveryStatus;
    providerStatus?: string | null;
    actor?: DeliveryAuditActor;
  }) {
    const kindMap: Partial<Record<ProviderDeliveryStatus, DeliveryTimelineKind>> = {
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
    const kind: DeliveryTimelineKind =
      kindMap[input.internalStatus] ?? "STATUS_CHANGED";

    await recordTimeline({
      providerDeliveryId: input.providerDeliveryId,
      orderId: input.orderId,
      businessId: input.businessId,
      provider: input.provider,
      kind,
      title: `Status: ${input.internalStatus}`,
      detail: input.providerStatus ? `Provider: ${input.providerStatus}` : null,
      metadata: { internalStatus: input.internalStatus },
      actor: input.actor ?? "SYSTEM",
    });
  }

  return { recordTimeline, recordAudit, recordStatusChange };
}

const defaultRecorder = createDeliveryTimelineRecorder();

export async function recordDeliveryTimeline(input: AppendTimelineInput) {
  return defaultRecorder.recordTimeline(input);
}

export async function recordDeliveryAudit(input: AppendAuditInput) {
  return defaultRecorder.recordAudit(input);
}

export async function recordDeliveryStatusTimeline(input: {
  providerDeliveryId: number;
  orderId: number;
  businessId: number;
  provider: string;
  internalStatus: ProviderDeliveryStatus;
  providerStatus?: string | null;
  actor?: DeliveryAuditActor;
}) {
  return defaultRecorder.recordStatusChange(input);
}
