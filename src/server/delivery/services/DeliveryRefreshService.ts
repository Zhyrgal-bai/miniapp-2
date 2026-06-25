import type { YandexClaimSnapshot } from "../providers/yandex/adapters/yandexClaimsInfoAdapter.js";
import {
  defaultYandexClaimsInfoService,
  type YandexClaimsInfoService,
} from "../providers/yandex/services/YandexClaimsInfoService.js";
import { mapYandexStatusToInternal } from "../providers/yandex/services/YandexDeliveryStatusMapper.js";
import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import {
  createDeliveryRefreshApplyService,
  type DeliveryRefreshApplyServiceDeps,
} from "./deliveryRefreshApplyService.js";
import { incrementDeliveryMetric } from "../utils/deliveryMetrics.js";
import { recordDeliveryTimeline } from "../operations/services/deliveryTimelineRecorder.js";

export type RefreshClaimResult =
  | {
      ok: true;
      applied: boolean;
      duplicate: boolean;
      orderId: number;
      internalStatus: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
      retryable: boolean;
      orderId?: number;
    };

export type DeliveryRefreshServiceDeps = DeliveryRefreshApplyServiceDeps & {
  repository?: ProviderDeliveryRepository;
  claimsInfoService?: YandexClaimsInfoService;
};

export function createDeliveryRefreshService(deps: DeliveryRefreshServiceDeps = {}) {
  const repository = deps.repository ?? createProviderDeliveryRepository();
  const claimsInfoService = deps.claimsInfoService ?? defaultYandexClaimsInfoService;
  const applyService = createDeliveryRefreshApplyService(deps);

  async function refreshClaim(
    providerClaimId: string,
    opts?: {
      fallbackUpdatedAt?: Date;
      idempotencyKey?: string;
      source?: "webhook" | "recovery" | "manual";
    },
  ): Promise<RefreshClaimResult> {
    const claimId = providerClaimId.trim();
    if (claimId === "") {
      return {
        ok: false,
        code: "validation_error",
        error: "claimId is required",
        retryable: false,
      };
    }

    const delivery = await repository.findByProviderClaimId(claimId);
    if (!delivery) {
      return {
        ok: false,
        code: "claim_not_found",
        error: "ProviderDelivery not found",
        retryable: false,
      };
    }

    if (opts?.source === "webhook") {
      void recordDeliveryTimeline({
        providerDeliveryId: delivery.id,
        orderId: delivery.orderId,
        businessId: delivery.businessId,
        provider: delivery.provider,
        kind: "WEBHOOK_RECEIVED",
        title: "Webhook received",
        actor: "WEBHOOK",
      });
    }

    const infoResult = await claimsInfoService.getClaimInfo(claimId, {
      ...(opts?.fallbackUpdatedAt ? { fallbackUpdatedAt: opts.fallbackUpdatedAt } : {}),
    });

    if (!infoResult.ok) {
      if (infoResult.code === "timeout") {
        incrementDeliveryMetric("provider_timeout_total");
      }
      if (infoResult.code === "rate_limited") {
        incrementDeliveryMetric("provider_rate_limit_total");
      }
      return {
        ok: false,
        code: infoResult.code,
        error: infoResult.error,
        retryable:
          infoResult.code === "timeout" ||
          infoResult.code === "network_error" ||
          infoResult.code === "rate_limited" ||
          infoResult.code === "api_error",
        orderId: delivery.orderId,
      };
    }

    const snapshot: YandexClaimSnapshot = infoResult.snapshot;
    const internalStatus = mapYandexStatusToInternal(snapshot.providerStatus);

    if (internalStatus == null) {
      return {
        ok: false,
        code: "unknown_status",
        error: `Unknown provider status: ${snapshot.providerStatus}`,
        retryable: false,
        orderId: delivery.orderId,
      };
    }

    const idempotencyKey =
      opts?.idempotencyKey ??
      `poll:${claimId}:${snapshot.providerUpdatedAt.toISOString()}`;

    const applyResult = await applyService.applySnapshot({
      delivery,
      snapshot,
      internalStatus,
      idempotencyKey,
      source: opts?.source ?? "recovery",
    });

    return {
      ok: true,
      applied: applyResult.applied,
      duplicate: applyResult.duplicate,
      orderId: applyResult.orderId,
      internalStatus,
    };
  }

  return { refreshClaim };
}

export type DeliveryRefreshService = ReturnType<typeof createDeliveryRefreshService>;

const defaultService = createDeliveryRefreshService();

export async function refreshDeliveryClaim(
  providerClaimId: string,
  opts?: Parameters<ReturnType<typeof createDeliveryRefreshService>["refreshClaim"]>[1],
): Promise<RefreshClaimResult> {
  return defaultService.refreshClaim(providerClaimId, opts);
}
