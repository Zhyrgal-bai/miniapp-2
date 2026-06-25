import type { YandexClaimSnapshot } from "../providers/yandex/adapters/yandexClaimsInfoAdapter.js";
import {
  deliveryEventNameForStatus,
  emitDeliveryEvent,
} from "./deliveryEvents.js";
import { createDeliveryStatusSyncService } from "./deliveryStatusSyncService.js";
import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import type {
  ProviderDeliveryRecord,
  ProviderDeliveryStatus,
} from "../types/providerDeliveryTypes.js";
import {
  shouldAdvanceStatus,
} from "../providers/yandex/services/YandexDeliveryStatusMapper.js";
import {
  incrementDeliveryMetric,
} from "../utils/deliveryMetrics.js";
import { recordDeliveryStatusTimeline } from "../operations/services/deliveryTimelineRecorder.js";
import {
  logDeliveryStatusUpdated,
  logDeliveryTrackingUpdated,
} from "../providers/yandex/utils/yandexWebhookLogging.js";

export type ApplySnapshotInput = {
  delivery: ProviderDeliveryRecord;
  snapshot: YandexClaimSnapshot;
  internalStatus: ProviderDeliveryStatus;
  idempotencyKey: string;
  source: "webhook" | "recovery" | "manual";
};

export type ApplySnapshotResult = {
  applied: boolean;
  duplicate: boolean;
  orderId: number;
  previousStatus: ProviderDeliveryStatus;
  internalStatus: ProviderDeliveryStatus;
};

export type DeliveryRefreshApplyServiceDeps = {
  repository?: ProviderDeliveryRepository;
  syncOrder?: ReturnType<typeof createDeliveryStatusSyncService>;
};

export function createDeliveryRefreshApplyService(
  deps: DeliveryRefreshApplyServiceDeps = {},
) {
  const repository = deps.repository ?? createProviderDeliveryRepository();
  const syncOrder = deps.syncOrder ?? createDeliveryStatusSyncService();

  async function applySnapshot(input: ApplySnapshotInput): Promise<ApplySnapshotResult> {
    const { delivery, snapshot, internalStatus, idempotencyKey } = input;
    const previousStatus = delivery.status;

    const appendResult = await repository.appendStatusEvent({
      providerDeliveryId: delivery.id,
      providerStatus: snapshot.providerStatus,
      internalStatus,
      providerUpdatedAt: snapshot.providerUpdatedAt,
      webhookKey: idempotencyKey,
      courierName: snapshot.courierName,
      vehicleNumber: snapshot.vehicleNumber,
      etaMinutes: snapshot.etaMinutes,
    });

    if (!appendResult.ok) {
      throw new Error(appendResult.error);
    }

    if (appendResult.duplicate) {
      return {
        applied: false,
        duplicate: true,
        orderId: delivery.orderId,
        previousStatus,
        internalStatus,
      };
    }

    const shouldUpdateSnapshot =
      !delivery.providerUpdatedAt ||
      snapshot.providerUpdatedAt.getTime() >= delivery.providerUpdatedAt.getTime();

    if (!shouldUpdateSnapshot || !shouldAdvanceStatus(delivery.status, internalStatus)) {
      return {
        applied: false,
        duplicate: false,
        orderId: delivery.orderId,
        previousStatus,
        internalStatus,
      };
    }

    await repository.updateTrackingSnapshot(delivery.id, {
      status: internalStatus,
      providerStatus: snapshot.providerStatus,
      providerUpdatedAt: snapshot.providerUpdatedAt,
      lastWebhookKey: idempotencyKey,
      courierName: snapshot.courierName,
      courierPhone: snapshot.courierPhone,
      vehicleNumber: snapshot.vehicleNumber,
      etaMinutes: snapshot.etaMinutes,
      trackingUrl: snapshot.trackingUrl,
      courierLat: snapshot.courierLat,
      courierLng: snapshot.courierLng,
    });

    await repository.clearRecoveryState(delivery.id);

    await syncOrder.syncOrderDeliveryFields({
      orderId: delivery.orderId,
      internalStatus,
    });

    logDeliveryStatusUpdated({
      orderId: delivery.orderId,
      merchantId: delivery.businessId,
      internalStatus,
      providerStatus: snapshot.providerStatus,
    });

    logDeliveryTrackingUpdated({
      orderId: delivery.orderId,
      hasCourier: Boolean(snapshot.courierName),
      hasEta: snapshot.etaMinutes != null,
    });

    emitStatusEvents(delivery, internalStatus);

    void recordDeliveryStatusTimeline({
      providerDeliveryId: delivery.id,
      orderId: delivery.orderId,
      businessId: delivery.businessId,
      provider: delivery.provider,
      internalStatus,
      providerStatus: snapshot.providerStatus,
      actor:
        input.source === "webhook"
          ? "WEBHOOK"
          : input.source === "recovery"
            ? "RECOVERY"
            : "SYSTEM",
    });

    if (internalStatus === "DELIVERED") {
      incrementDeliveryMetric("delivery_completed_total");
    }
    if (internalStatus === "FAILED" || internalStatus === "RECOVERY_REQUIRED") {
      incrementDeliveryMetric("delivery_failed_total");
    }

    return {
      applied: true,
      duplicate: false,
      orderId: delivery.orderId,
      previousStatus,
      internalStatus,
    };
  }

  return { applySnapshot };
}

function emitStatusEvents(
  delivery: ProviderDeliveryRecord,
  internalStatus: ProviderDeliveryStatus,
): void {
  const payload = {
    orderId: delivery.orderId,
    businessId: delivery.businessId,
    provider: "yandex" as const,
    internalStatus,
    previousStatus: delivery.status,
  };

  const named = deliveryEventNameForStatus(internalStatus);
  if (named) {
    emitDeliveryEvent(named, payload);
  } else {
    emitDeliveryEvent("delivery_status_changed", payload);
  }
}

const defaultService = createDeliveryRefreshApplyService();

export async function applyDeliverySnapshot(
  input: ApplySnapshotInput,
): Promise<ApplySnapshotResult> {
  return defaultService.applySnapshot(input);
}
