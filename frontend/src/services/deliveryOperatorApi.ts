import { apiAbsoluteUrl } from "./api";
import { formatHttpStatusError } from "../utils/adminApiError";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";
import type {
  DeliveryAnalyticsPeriod,
  DeliveryAnalyticsReport,
  DeliveryDetailsView,
  DeliverySearchFilters,
  DeliverySearchResult,
  DeliveryUiEvent,
  OperatorDeliveryDashboard,
} from "../types/deliveryAdmin.types";

type OperatorCallOptions = {
  operatorSessionToken: string;
};

function operatorHeaders(token: string): HeadersInit {
  return {
    ...telegramWebAppInitDataHeader(),
    "x-operator-session": token,
  };
}

async function operatorFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...operatorHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(formatHttpStatusError(res.status, j.message ?? j.error ?? ""));
  }
  return res;
}

async function operatorJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await operatorFetch(url, token, init);
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

function buildSearchParams(
  filters: DeliverySearchFilters,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.claimId?.trim()) params.set("claimId", filters.claimId.trim());
  if (filters.orderId?.trim()) params.set("orderId", filters.orderId.trim());
  if (filters.merchantId?.trim()) params.set("merchantId", filters.merchantId.trim());
  if (filters.customerName?.trim()) params.set("customerName", filters.customerName.trim());
  if (filters.phone?.trim()) params.set("phone", filters.phone.trim());
  if (filters.provider?.trim()) params.set("provider", filters.provider.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.recoveryStatus) params.set("recoveryStatus", filters.recoveryStatus);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const q = filters.q?.trim();
  if (q) {
    if (/^\d+$/.test(q)) params.set("orderId", q);
    else if (q.length >= 6) params.set("claimId", q);
    else params.set("customerName", q);
  }
  return params;
}

export async function fetchOperatorDeliveryDashboard(
  token: string,
  period: DeliveryAnalyticsPeriod = "daily",
): Promise<OperatorDeliveryDashboard> {
  const url = apiAbsoluteUrl(`/api/operator/delivery/dashboard?period=${period}`);
  return operatorJson(url, token);
}

export async function searchOperatorDeliveries(
  token: string,
  filters: DeliverySearchFilters,
  page: number,
  pageSize: number,
): Promise<DeliverySearchResult> {
  const params = buildSearchParams(filters, page, pageSize);
  const url = apiAbsoluteUrl(`/api/operator/delivery/search?${params}`);
  return operatorJson(url, token);
}

export async function fetchOperatorDeliveryDetails(
  token: string,
  deliveryId: number,
): Promise<DeliveryDetailsView> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}`);
  return operatorJson(url, token);
}

export async function fetchOperatorDeliveryTimeline(
  token: string,
  deliveryId: number,
): Promise<{ events: DeliveryUiEvent[] }> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}/timeline`);
  return operatorJson(url, token);
}

export async function fetchOperatorDeliveryAudit(
  token: string,
  deliveryId: number,
): Promise<{ audit: DeliveryDetailsView["audit"] }> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}/audit`);
  return operatorJson(url, token);
}

export async function refreshOperatorDelivery(
  token: string,
  deliveryId: number,
): Promise<{ ok: boolean; message?: string }> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}/refresh`);
  return operatorJson(url, token, { method: "POST" });
}

export async function forceRefreshOperatorDelivery(
  token: string,
  deliveryId: number,
): Promise<{ ok: boolean; message?: string }> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}/force-refresh`);
  return operatorJson(url, token, { method: "POST" });
}

export async function retryOperatorDeliveryRecovery(
  token: string,
  deliveryId: number,
): Promise<{ ok: boolean; message?: string }> {
  const url = apiAbsoluteUrl(`/api/operator/deliveries/${deliveryId}/retry-recovery`);
  return operatorJson(url, token, { method: "POST" });
}

export async function fetchOperatorDeliveryAnalytics(
  token: string,
  period: DeliveryAnalyticsPeriod,
): Promise<DeliveryAnalyticsReport> {
  const url = apiAbsoluteUrl(`/api/operator/delivery/analytics?period=${period}`);
  return operatorJson(url, token);
}

export async function downloadOperatorDeliveryExport(
  token: string,
  options: {
    type: "dashboard" | "analytics" | "timeline" | "audit" | "search";
    format: "csv" | "xlsx" | "json";
    period?: DeliveryAnalyticsPeriod;
    deliveryId?: number;
  },
): Promise<Blob> {
  const params = new URLSearchParams();
  params.set("type", options.type);
  params.set("format", options.format === "xlsx" ? "csv" : options.format);
  if (options.period) params.set("period", options.period);
  if (options.deliveryId != null) params.set("deliveryId", String(options.deliveryId));
  const url = apiAbsoluteUrl(`/api/operator/delivery/export?${params}`);
  const res = await operatorFetch(url, token);
  return res.blob();
}

export type { OperatorCallOptions };
