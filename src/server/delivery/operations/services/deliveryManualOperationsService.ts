import { getProviderRecovery } from "../../providers/deliveryProviderRecoveryRegistry.js";
import {
  createDeliveryRefreshService,
  type DeliveryRefreshService,
} from "../../services/DeliveryRefreshService.js";
import type { ProviderDeliveryRecord } from "../../types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import {
  createDeliveryOperationsRepository,
} from "../repositories/deliveryOperationsRepository.js";
import { createDeliveryTimelineRecorder } from "./deliveryTimelineRecorder.js";
import { computeNextRetryAt } from "../../providers/deliveryProviderRetryPolicy.js";
import { incrementDeliveryMetric } from "../../utils/deliveryMetrics.js";
import {
  logDeliveryOpened as logOpened,
  logDeliveryRefreshed,
} from "../utils/deliveryOperationsLogging.js";

export type ManualOperationResult =
  | { ok: true; applied: boolean; internalStatus?: string }
  | { ok: false; code: string; message: string };

export type ManualOpsActor = {
  actor: "MERCHANT" | "PLATFORM_OPERATOR";
  actorId?: string;
};

export function createDeliveryManualOperationsService(deps?: {
  repository?: ProviderDeliveryRepository;
  refreshService?: DeliveryRefreshService;
  operationsRepo?: ReturnType<typeof createDeliveryOperationsRepository>;
  recorder?: ReturnType<typeof createDeliveryTimelineRecorder>;
}) {
  const repository = deps?.repository ?? createProviderDeliveryRepository();
  const operationsRepo =
    deps?.operationsRepo ?? createDeliveryOperationsRepository({ providerRepo: repository });
  const refreshService = deps?.refreshService ?? createDeliveryRefreshService({ repository });
  const recorder = deps?.recorder ?? createDeliveryTimelineRecorder();

  async function loadDelivery(
    deliveryId: number,
    businessId?: number,
  ): Promise<ProviderDeliveryRecord | null> {
    if (businessId != null) {
      const row = await operationsRepo.findByIdForBusiness(deliveryId, businessId);
      return row?.delivery ?? null;
    }
    const row = await operationsRepo.findById(deliveryId);
    return row?.delivery ?? null;
  }

  async function refreshDelivery(
    deliveryId: number,
    actor: ManualOpsActor,
    options?: { force?: boolean; businessId?: number },
  ): Promise<ManualOperationResult> {
    const row = await loadDelivery(deliveryId, options?.businessId);
    if (!row) {
      return { ok: false, code: "not_found", message: "Delivery not found" };
    }

    const claimId = row.providerClaimId?.trim() ?? "";
    if (claimId === "") {
      return { ok: false, code: "no_claim", message: "No provider claim id" };
    }

    const kind = options?.force ? "FORCE_REFRESH" : "MANUAL_REFRESH";

    const result = await refreshService.refreshClaim(claimId, {
      idempotencyKey: `${kind.toLowerCase()}:${deliveryId}:${Date.now()}`,
      source: "manual",
    });

    await recorder.recordTimeline({
      providerDeliveryId: row.id,
      orderId: row.orderId,
      businessId: row.businessId,
      provider: row.provider,
      kind,
      title: options?.force ? "Force refresh" : "Manual refresh",
      actor: actor.actor,
      metadata: { ok: result.ok },
    });

    await recorder.recordAudit({
      providerDeliveryId: row.id,
      orderId: row.orderId,
      businessId: row.businessId,
      provider: row.provider,
      actor: actor.actor,
      actorId: actor.actorId ?? null,
      action: kind,
      details: { ok: result.ok },
    });

    incrementDeliveryMetric("delivery_manual_refresh_total");
    logDeliveryRefreshed({
      deliveryId: row.id,
      orderId: row.orderId,
      force: Boolean(options?.force),
      actor: actor.actor,
    });

    if (!result.ok) {
      return { ok: false, code: result.code, message: result.error };
    }

    return {
      ok: true,
      applied: result.applied,
      internalStatus: result.internalStatus,
    };
  }

  async function retryRecovery(
    deliveryId: number,
    actor: ManualOpsActor,
    options?: { businessId?: number },
  ): Promise<ManualOperationResult> {
    const row = await loadDelivery(deliveryId, options?.businessId);
    if (!row) {
      return { ok: false, code: "not_found", message: "Delivery not found" };
    }

    const claimId = row.providerClaimId?.trim() ?? "";
    if (claimId === "") {
      return { ok: false, code: "no_claim", message: "No provider claim id" };
    }

    const port = getProviderRecovery(row.provider);
    const result = await port.refreshClaim(claimId);

    if (!result.ok && result.retryable) {
      const nextAttempt = row.recoveryRetryCount + 1;
      await repository.updateRecoveryState(row.id, {
        recoveryRetryCount: nextAttempt,
        recoveryNextRetryAt: computeNextRetryAt(nextAttempt),
        recoveryLastError: result.code,
      });
      incrementDeliveryMetric("delivery_retry_total");
    }

    await recorder.recordTimeline({
      providerDeliveryId: row.id,
      orderId: row.orderId,
      businessId: row.businessId,
      provider: row.provider,
      kind: "MANUAL_RETRY",
      title: "Manual recovery retry",
      actor: actor.actor,
      metadata: { ok: result.ok },
    });

    await recorder.recordAudit({
      providerDeliveryId: row.id,
      orderId: row.orderId,
      businessId: row.businessId,
      provider: row.provider,
      actor: actor.actor,
      actorId: actor.actorId ?? null,
      action: "MANUAL_RETRY",
      details: { ok: result.ok },
    });

    incrementDeliveryMetric("delivery_recovery_total");

    if (!result.ok) {
      return { ok: false, code: result.code, message: result.error };
    }

    return { ok: true, applied: result.applied, internalStatus: result.internalStatus };
  }

  function logDeliveryOpened(deliveryId: number, orderId: number, actor: ManualOpsActor) {
    logOpened({ deliveryId, orderId, actor: actor.actor });
  }

  return {
    refreshDelivery,
    retryRecovery,
    logDeliveryOpened,
  };
}
