import { api, apiAbsoluteUrl } from "./api";
import { adminFetchJson } from "./adminRequest";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type FloorTableDto = {
  id: number;
  name: string;
  seats: number;
  shape: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  liveStatus: string;
  qrToken: string;
  session: {
    id: number;
    partySize: number | null;
    seatedAt: string;
    seatedMinutes: number;
    status: string;
    paymentRequestedAt: string | null;
    orders: Array<{
      id: number;
      orderNumber: string | null;
      total: number;
      prepStatus: string;
      status: string;
    }>;
  } | null;
};

export type FloorSnapshot = {
  at: string;
  tables: FloorTableDto[];
  reservations: Array<{
    id: number;
    tableId: number;
    reservedAt: string;
    guestName: string | null;
    partySize: number | null;
    status: string;
  }>;
};

export type KitchenOrderRow = {
  id: number;
  orderNumber: string | null;
  prepStatus: string;
  status: string;
  total: number;
  createdAt: string;
  tableSession: { table: { name: string } } | null;
};

export async function fetchVenueFloor(businessId: number): Promise<FloorSnapshot> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/venue/floor"));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson(url.toString(), { method: "GET", businessId, json: false });
}

export async function fetchVenueKitchen(businessId: number): Promise<{ orders: KitchenOrderRow[] }> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/venue/kitchen"));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson(url.toString(), { method: "GET", businessId, json: false });
}

export async function fetchVenueMetrics(businessId: number): Promise<{
  avgTableMinutes: number;
  tableCount: number;
  activeSessions: number;
  turnover7d: number;
  busiestHour: string | null;
  occupancyPercent: number;
}> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/venue/metrics"));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson(url.toString(), { method: "GET", businessId, json: false });
}

export async function venueOpenSession(
  businessId: number,
  body: { tableId: number; reservationId?: number; partySize?: number },
): Promise<{ sessionId: number }> {
  const url = apiAbsoluteUrl("/api/merchant/venue/sessions/open?shop=" + businessId);
  return adminFetchJson(url, { method: "POST", businessId, body: JSON.stringify(body) });
}

export async function venueRequestPayment(businessId: number, sessionId: number): Promise<void> {
  const url = apiAbsoluteUrl(
    `/api/merchant/venue/sessions/${sessionId}/request-payment?shop=${businessId}`,
  );
  await adminFetchJson(url, { method: "POST", businessId, body: "{}" });
}

export async function venueCloseSession(businessId: number, sessionId: number): Promise<void> {
  const url = apiAbsoluteUrl(`/api/merchant/venue/sessions/${sessionId}/close?shop=${businessId}`);
  await adminFetchJson(url, { method: "POST", businessId, body: "{}" });
}

export async function venueSetPrep(
  businessId: number,
  orderId: number,
  prepStatus: string,
): Promise<void> {
  const url = apiAbsoluteUrl(`/api/merchant/venue/orders/${orderId}/prep?shop=${businessId}`);
  await adminFetchJson(url, {
    method: "PATCH",
    businessId,
    body: JSON.stringify({ prepStatus }),
  });
}

export async function joinTableQr(token: string, partySize?: number): Promise<{
  businessId: number;
  tableSessionId: number;
  tableName: string;
}> {
  const url = apiAbsoluteUrl(`/api/storefront/table-qr/${encodeURIComponent(token)}/join`);
  const res = await api.post(url, { partySize }, { headers: telegramWebAppInitDataHeader() });
  return res.data;
}

export function venueLiveStreamUrl(businessId: number): string {
  const url = new URL(apiAbsoluteUrl("/api/merchant/venue/live-stream"));
  url.searchParams.set("shop", String(businessId));
  return url.toString();
}
