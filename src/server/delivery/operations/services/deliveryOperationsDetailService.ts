import { getDeliveryMetricsSnapshot } from "../../utils/deliveryMetrics.js";
import { getProviderPortalUrl } from "../../providers/deliveryProviderOperationsRegistry.js";
import { resolveOperationsCapabilityMatrix } from "../../engine/ProviderCapabilityResolver.js";
import {
  createDeliveryTimelineRepository,
  type DeliveryTimelineRepository,
} from "../repositories/deliveryTimelineRepository.js";
import {
  createDeliveryAuditRepository,
  type DeliveryAuditRepository,
} from "../repositories/deliveryAuditRepository.js";
import {
  createDeliveryOperationsRepository,
  type DeliveryOperationsRepository,
} from "../repositories/deliveryOperationsRepository.js";
import type { DeliveryAuditRecord, DeliveryTimelineRecord } from "../types/deliveryOperationsTypes.js";
import { maskPhone } from "../dto/deliveryOperationsDto.js";

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
  customer: { name: string; phoneMasked: string; orderId: number; orderNumber: string | null };
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
  metrics: ReturnType<typeof getDeliveryMetricsSnapshot>;
  timeline: DeliveryTimelineRecord[];
  audit: DeliveryAuditRecord[];
  actions: {
    canRefresh: boolean;
    canRetryRecovery: boolean;
    canForceRefresh: boolean;
    providerPortalUrl: string | null;
    capabilities: import("../../engine/types/deliveryEngineTypes.js").OperationsCapabilityMatrix;
    copy: {
      claimId: string | null;
      orderId: number;
      merchantId: number;
    };
  };
};

export function createDeliveryOperationsDetailService(deps?: {
  operationsRepo?: DeliveryOperationsRepository;
  timelineRepo?: DeliveryTimelineRepository;
  auditRepo?: DeliveryAuditRepository;
}) {
  const operationsRepo = deps?.operationsRepo ?? createDeliveryOperationsRepository();
  const timelineRepo = deps?.timelineRepo ?? createDeliveryTimelineRepository();
  const auditRepo = deps?.auditRepo ?? createDeliveryAuditRepository();

  async function getDetails(
    deliveryId: number,
    options?: { businessId?: number; includeAudit?: boolean },
  ): Promise<{ ok: true; details: DeliveryDetailsView } | { ok: false; code: string }> {
    const row =
      options?.businessId != null
        ? await operationsRepo.findByIdForBusiness(deliveryId, options.businessId)
        : await operationsRepo.findById(deliveryId);

    if (!row) {
      return { ok: false, code: "not_found" };
    }

    const { delivery, order, merchant } = row;
    const [timeline, audit] = await Promise.all([
      timelineRepo.listByDeliveryId(delivery.id),
      options?.includeAudit !== false
        ? auditRepo.listByDeliveryId(delivery.id)
        : Promise.resolve([]),
    ]);

    const claimId = delivery.providerClaimId;
    const inRecoveryQueue =
      delivery.status === "RECOVERY_REQUIRED" || delivery.recoveryRetryCount > 0;

    const capabilities = resolveOperationsCapabilityMatrix(delivery.provider, {
      hasClaimId: claimId != null && claimId !== "",
      inRecovery: inRecoveryQueue,
    });

    const details: DeliveryDetailsView = {
      delivery: {
        id: delivery.id,
        status: delivery.status,
        providerStatus: delivery.providerStatus,
        provider: delivery.provider,
        providerClaimId: claimId,
        providerOfferId: delivery.providerOfferId,
        price: delivery.price,
        currency: delivery.currency,
        etaMinutes: delivery.etaMinutes,
        trackingUrl: delivery.trackingUrl,
        courierName: delivery.courierName,
        vehicleNumber: delivery.vehicleNumber,
        providerUpdatedAt: delivery.providerUpdatedAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
      },
      merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug },
      customer: {
        name: order.name,
        phoneMasked: maskPhone(order.phone),
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        deliveryFee: order.deliveryFee,
        createdAt: order.createdAt.toISOString(),
      },
      recovery: {
        retryCount: delivery.recoveryRetryCount,
        nextRetryAt: delivery.recoveryNextRetryAt?.toISOString() ?? null,
        lastError: delivery.recoveryLastError,
        inRecoveryQueue,
      },
      tracking: {
        hasCourier: Boolean(delivery.courierName),
        hasEta: delivery.etaMinutes != null,
        hasTrackingUrl: Boolean(delivery.trackingUrl),
      },
      metrics: getDeliveryMetricsSnapshot(),
      timeline,
      audit,
      actions: {
        canRefresh: capabilities.refresh,
        canRetryRecovery: capabilities.retryRecovery,
        canForceRefresh: capabilities.forceRefresh,
        providerPortalUrl:
          claimId != null && claimId !== ""
            ? getProviderPortalUrl(delivery.provider, claimId)
            : null,
        capabilities,
        copy: {
          claimId,
          orderId: order.id,
          merchantId: merchant.id,
        },
      },
    };

    return { ok: true, details };
  }

  return { getDetails };
}
