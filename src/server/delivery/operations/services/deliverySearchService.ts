import type { ProviderDeliveryStatus } from "../../types/providerDeliveryTypes.js";
import {
  createDeliveryOperationsRepository,
} from "../repositories/deliveryOperationsRepository.js";
import type {
  DeliverySearchFilters,
  PaginatedResult,
} from "../types/deliveryOperationsTypes.js";
import type { DeliveryWithOrder } from "../repositories/deliveryOperationsRepository.js";
import { maskPhone } from "../dto/deliveryOperationsDto.js";
import { incrementDeliveryMetric } from "../../utils/deliveryMetrics.js";
import { logDeliverySearched } from "../utils/deliveryOperationsLogging.js";

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
};

export type DeliverySearchResult = PaginatedResult<DeliverySearchResultItem>;

function parseRecoveryStatus(
  raw: string | undefined,
): DeliverySearchFilters["recoveryStatus"] {
  if (raw === "recovering" || raw === "recovery_required" || raw === "none") {
    return raw;
  }
  return undefined;
}

export function parseDeliverySearchQuery(
  query: Record<string, unknown>,
  businessId?: number,
): { filters: DeliverySearchFilters; page: number; pageSize: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

  const filters: DeliverySearchFilters = {
    ...(businessId != null ? { businessId } : {}),
    ...(typeof query.claimId === "string" ? { claimId: query.claimId } : {}),
    ...(query.orderId != null && query.orderId !== ""
      ? { orderId: Number(query.orderId) }
      : {}),
    ...(typeof query.merchantId === "string" || query.merchantId != null
      ? { businessId: Number(query.merchantId ?? query.businessId) }
      : {}),
    ...(typeof query.customerName === "string"
      ? { customerName: query.customerName }
      : {}),
    ...(typeof query.phone === "string" ? { phone: query.phone } : {}),
    ...(typeof query.provider === "string" ? { provider: query.provider } : {}),
    ...(typeof query.status === "string"
      ? { status: query.status as ProviderDeliveryStatus }
      : {}),
    ...(typeof query.recoveryStatus === "string" &&
    parseRecoveryStatus(query.recoveryStatus) != null
      ? { recoveryStatus: parseRecoveryStatus(query.recoveryStatus)! }
      : {}),
    ...(typeof query.dateFrom === "string"
      ? { dateFrom: new Date(query.dateFrom) }
      : {}),
    ...(typeof query.dateTo === "string" ? { dateTo: new Date(query.dateTo) } : {}),
  };

  return { filters, page, pageSize };
}

function mapItem(row: DeliveryWithOrder): DeliverySearchResultItem {
  const { delivery, order, merchant } = row;
  return {
    deliveryId: delivery.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    merchantId: merchant.id,
    merchantName: merchant.name,
    customerName: order.name,
    phoneMasked: maskPhone(order.phone),
    provider: delivery.provider,
    providerClaimId: delivery.providerClaimId,
    status: delivery.status,
    recoveryRetryCount: delivery.recoveryRetryCount,
    inRecovery:
      delivery.status === "RECOVERY_REQUIRED" || delivery.recoveryRetryCount > 0,
    createdAt: delivery.createdAt.toISOString(),
    providerUpdatedAt: delivery.providerUpdatedAt?.toISOString() ?? null,
  };
}

export function createDeliverySearchService(deps?: {
  operationsRepo?: ReturnType<typeof createDeliveryOperationsRepository>;
}) {
  const operationsRepo = deps?.operationsRepo ?? createDeliveryOperationsRepository();

  async function search(
    filters: DeliverySearchFilters,
    page: number,
    pageSize: number,
    actor: string,
  ): Promise<DeliverySearchResult> {
    const result = await operationsRepo.search(filters, page, pageSize);
    incrementDeliveryMetric("delivery_search_total");
    logDeliverySearched({
      resultCount: result.items.length,
      page,
      actor,
    });
    return {
      ...result,
      items: result.items.map(mapItem),
    };
  }

  return { search };
}
