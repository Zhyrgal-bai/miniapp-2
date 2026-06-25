import { apiAbsoluteUrl } from "./api";
import { adminFetchJson } from "./adminRequest";
import type {
  DeliveryAnalyticsPeriod,
  DeliveryAnalyticsReport,
  DeliveryDetailsView,
  DeliveryProviderPublic,
  DeliverySearchFilters,
  DeliverySearchResult,
  DeliveryUiEvent,
  MerchantDeliveryDashboard,
  MerchantDeliveryProviderPolicy,
} from "../types/deliveryAdmin.types";

function buildSearchParams(
  businessId: number,
  filters: DeliverySearchFilters,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("shop", String(businessId));
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.claimId?.trim()) params.set("claimId", filters.claimId.trim());
  if (filters.orderId?.trim()) params.set("orderId", filters.orderId.trim());
  if (filters.customerName?.trim()) params.set("customerName", filters.customerName.trim());
  if (filters.phone?.trim()) params.set("phone", filters.phone.trim());
  if (filters.provider?.trim()) params.set("provider", filters.provider.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.recoveryStatus) params.set("recoveryStatus", filters.recoveryStatus);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const q = filters.q?.trim();
  if (q) {
    if (/^\d+$/.test(q)) {
      params.set("orderId", q);
    } else if (q.length >= 8 && /[a-z0-9-]/i.test(q)) {
      params.set("claimId", q);
    } else {
      params.set("customerName", q);
    }
  }
  return params;
}

export async function fetchMerchantDeliveryDashboard(
  businessId: number,
): Promise<MerchantDeliveryDashboard> {
  const url = apiAbsoluteUrl(`/api/merchant/delivery/dashboard?shop=${businessId}`);
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function searchMerchantDeliveries(
  businessId: number,
  filters: DeliverySearchFilters,
  page: number,
  pageSize: number,
): Promise<DeliverySearchResult> {
  const params = buildSearchParams(businessId, filters, page, pageSize);
  const url = apiAbsoluteUrl(`/api/merchant/delivery/search?${params}`);
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function fetchMerchantDeliveryDetails(
  businessId: number,
  deliveryId: number,
): Promise<DeliveryDetailsView> {
  const url = apiAbsoluteUrl(
    `/api/merchant/delivery/${deliveryId}?shop=${businessId}`,
  );
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function fetchMerchantDeliveryTimeline(
  businessId: number,
  deliveryId: number,
): Promise<{ events: DeliveryUiEvent[] }> {
  const url = apiAbsoluteUrl(
    `/api/merchant/delivery/${deliveryId}/timeline?shop=${businessId}`,
  );
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function refreshMerchantDelivery(
  businessId: number,
  deliveryId: number,
): Promise<{ ok: boolean; message?: string }> {
  const url = apiAbsoluteUrl(
    `/api/merchant/delivery/${deliveryId}/refresh?shop=${businessId}`,
  );
  return adminFetchJson(url, { method: "POST", businessId });
}

export async function fetchMerchantDeliveryAnalytics(
  businessId: number,
  period: DeliveryAnalyticsPeriod,
): Promise<DeliveryAnalyticsReport> {
  const url = apiAbsoluteUrl(
    `/api/merchant/delivery/analytics?shop=${businessId}&period=${period}`,
  );
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function fetchMerchantDeliveryProviders(
  businessId: number,
): Promise<{ policy: MerchantDeliveryProviderPolicy; providers: DeliveryProviderPublic[] }> {
  const url = apiAbsoluteUrl(`/api/merchant/delivery/providers?shop=${businessId}`);
  return adminFetchJson(url, { method: "GET", businessId, json: false });
}

export async function updateMerchantDeliveryProviders(
  businessId: number,
  policy: Partial<MerchantDeliveryProviderPolicy>,
): Promise<{ ok: boolean; policy: MerchantDeliveryProviderPolicy }> {
  const url = apiAbsoluteUrl(`/api/merchant/delivery/providers?shop=${businessId}`);
  return adminFetchJson(url, {
    method: "PATCH",
    businessId,
    body: JSON.stringify(policy),
  });
}
