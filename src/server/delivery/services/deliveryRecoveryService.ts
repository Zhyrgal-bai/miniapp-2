import type { ProviderDeliveryRecord } from "../types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import type { ProviderRecoveryPort } from "../providers/deliveryProviderRecoveryPort.js";
import { listRegisteredRecoveryProviders } from "../providers/deliveryProviderRecoveryRegistry.js";
import {
  computeNextRetryAt,
  shouldMoveToDeadLetter,
} from "../providers/deliveryProviderRetryPolicy.js";
import {
  getDeliveryRecoveryBatchSize,
  isDeliveryRecoveryEnabled,
} from "./deliveryRecoveryConfig.js";
import { incrementDeliveryMetric } from "../utils/deliveryMetrics.js";
import {
  logDeliveryDeadLetter,
  logDeliveryRecovered,
  logDeliveryRecoveryStarted,
  logDeliveryRetry,
} from "../utils/deliveryRecoveryLogging.js";
import { recordDeliveryTimeline } from "../operations/services/deliveryTimelineRecorder.js";

export type DeliveryRecoveryTickResult = {
  scanned: number;
  recovered: number;
  retried: number;
  deadLetter: number;
};

export type DeliveryRecoveryServiceDeps = {
  enabled?: () => boolean;
  repository?: ProviderDeliveryRepository;
  providers?: ProviderRecoveryPort[];
  batchSize?: () => number;
};

async function processDelivery(
  delivery: ProviderDeliveryRecord,
  port: ProviderRecoveryPort,
  repository: ProviderDeliveryRepository,
): Promise<"recovered" | "retried" | "dead_letter" | "skipped"> {
  const claimId = delivery.providerClaimId?.trim() ?? "";
  if (claimId === "") return "skipped";

  const result = await port.refreshClaim(claimId);

  if (result.ok) {
    if (result.applied) {
      incrementDeliveryMetric("delivery_recovered_total");
      logDeliveryRecovered({
        orderId: result.orderId,
        merchantId: delivery.businessId,
        internalStatus: result.internalStatus,
      });
      void recordDeliveryTimeline({
        providerDeliveryId: delivery.id,
        orderId: delivery.orderId,
        businessId: delivery.businessId,
        provider: delivery.provider,
        kind: "RECOVERY_RESOLVED",
        title: "Recovery resolved",
        actor: "RECOVERY",
      });
      return "recovered";
    }
    return "skipped";
  }

  if (!result.retryable) {
    return "skipped";
  }

  const nextAttempt = delivery.recoveryRetryCount + 1;

  if (shouldMoveToDeadLetter(nextAttempt)) {
    await repository.updateRecoveryState(delivery.id, {
      status: "RECOVERY_REQUIRED",
      recoveryRetryCount: nextAttempt,
      recoveryNextRetryAt: computeNextRetryAt(nextAttempt),
      recoveryLastError: result.code,
    });
    incrementDeliveryMetric("delivery_failed_total");
    logDeliveryDeadLetter({
      orderId: delivery.orderId,
      merchantId: delivery.businessId,
      retryCount: nextAttempt,
      code: result.code,
    });
    return "dead_letter";
  }

  const nextRetryAt = computeNextRetryAt(nextAttempt);
  await repository.updateRecoveryState(delivery.id, {
    recoveryRetryCount: nextAttempt,
    recoveryNextRetryAt: nextRetryAt,
    recoveryLastError: result.code,
  });
  incrementDeliveryMetric("delivery_retry_total");
  logDeliveryRetry({
    orderId: delivery.orderId,
    attempt: nextAttempt,
    nextRetryAt: nextRetryAt.toISOString(),
    code: result.code,
  });
  void recordDeliveryTimeline({
    providerDeliveryId: delivery.id,
    orderId: delivery.orderId,
    businessId: delivery.businessId,
    provider: delivery.provider,
    kind: "RECOVERY_RETRY",
    title: "Recovery retry scheduled",
    detail: result.code,
    actor: "RECOVERY",
    metadata: { attempt: nextAttempt },
  });
  return "retried";
}

export function createDeliveryRecoveryService(deps: DeliveryRecoveryServiceDeps = {}) {
  const enabled = deps.enabled ?? isDeliveryRecoveryEnabled;
  const repository = deps.repository ?? createProviderDeliveryRepository();
  const providers = deps.providers ?? listRegisteredRecoveryProviders();
  const batchSize = deps.batchSize ?? getDeliveryRecoveryBatchSize;

  async function runDeliveryRecoveryOnce(
    now = new Date(),
  ): Promise<DeliveryRecoveryTickResult> {
    const started = Date.now();
    const summary: DeliveryRecoveryTickResult = {
      scanned: 0,
      recovered: 0,
      retried: 0,
      deadLetter: 0,
    };

    if (!enabled()) {
      return summary;
    }

    const limit = batchSize();

    for (const port of providers) {
      const active = await port.listActiveDeliveries(limit);
      const dueRecovery = await repository.findRecoveryRequiredDue(
        now,
        limit,
        port.providerId,
      );

      const seen = new Set<number>();
      const candidates: ProviderDeliveryRecord[] = [];

      for (const d of [...active, ...dueRecovery]) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        if (d.provider !== port.providerId) continue;
        if (
          d.recoveryNextRetryAt != null &&
          d.recoveryNextRetryAt > now &&
          d.status !== "RECOVERY_REQUIRED"
        ) {
          continue;
        }
        candidates.push(d);
        if (candidates.length >= limit) break;
      }

      for (const delivery of candidates) {
        summary.scanned += 1;
        try {
          const outcome = await processDelivery(delivery, port, repository);
          if (outcome === "recovered") summary.recovered += 1;
          if (outcome === "retried") summary.retried += 1;
          if (outcome === "dead_letter") summary.deadLetter += 1;
        } catch {
          summary.retried += 1;
        }
      }
    }

    logDeliveryRecoveryStarted({
      ...summary,
      durationMs: Date.now() - started,
    });

    return summary;
  }

  return { runDeliveryRecoveryOnce };
}

const defaultService = createDeliveryRecoveryService();

export async function runDeliveryRecoveryOnce(
  now?: Date,
): Promise<DeliveryRecoveryTickResult> {
  return defaultService.runDeliveryRecoveryOnce(now);
}
