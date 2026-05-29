import { api, apiAbsoluteUrl } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type CustomerDiningTableDto = {
  id: number;
  name: string;
  seats: number;
  shape: "SQUARE" | "RECTANGLE" | "CIRCLE" | "VIP";
  posX: number;
  posY: number;
  width: number;
  height: number;
  status:
    | "FREE"
    | "RESERVED"
    | "ARRIVED"
    | "ORDERING"
    | "EATING"
    | "PAYMENT"
    | "CLEANING"
    | "AVAILABLE"
    | "OCCUPIED"
    | "SOON_OCCUPIED";
  bookable: boolean;
  nextReservation: { reservedAt: string } | null;
};

export type TableSlotDto = {
  time: string;
  available: boolean;
  reservedAt: string;
};

export type TableReservationDto = {
  id: number;
  tableId: number;
  tableName: string | null;
  tableSeats: number | null;
  reservedAt: string;
  partySize: number | null;
  guestName: string | null;
  guestPhone: string | null;
  guestNote: string | null;
  status: string;
  durationMinutes: number;
  createdAt: string;
  hasPreorder?: boolean;
  preorderStatus?: "none" | "pending" | "paid";
  preorderLabel?: string;
  depositStatus?: string;
  depositAmount?: number | null;
  depositPaidAt?: string | null;
  depositDueAt?: string | null;
  depositLabel?: string;
  canPayDeposit?: boolean;
};

function bookingHeaders(): Record<string, string> {
  return {
    ...telegramWebAppInitDataHeader(),
    "Content-Type": "application/json",
  };
}

export async function fetchCustomerDiningTables(
  businessId: number,
): Promise<{ supported: boolean; tables: CustomerDiningTableDto[]; hasBookableTables?: boolean }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/dining-tables`);
  const res = await api.get(url, { headers: bookingHeaders() });
  return res.data;
}

export async function fetchTableSlots(
  businessId: number,
  tableId: number,
  date: string,
): Promise<{ slots: TableSlotDto[]; durationMinutes: number }> {
  const url = apiAbsoluteUrl(
    `/api/storefront/${businessId}/dining-tables/slots?tableId=${tableId}&date=${encodeURIComponent(date)}`,
  );
  const res = await api.get(url, { headers: bookingHeaders() });
  return res.data;
}

export async function createTableReservation(
  businessId: number,
  body: {
    tableId: number;
    reservedAt: string;
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote?: string;
  },
): Promise<{ reservation: TableReservationDto }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/table-reservations`);
  const res = await api.post(url, body, { headers: bookingHeaders() });
  return res.data;
}

export async function fetchMyTableReservations(
  businessId: number,
): Promise<{ supported: boolean; reservations: TableReservationDto[] }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/table-reservations/mine`);
  const res = await api.get(url, { headers: bookingHeaders() });
  return res.data;
}

export async function payReservationDeposit(
  businessId: number,
  reservationId: number,
): Promise<{ paymentUrl: string; paymentId: string; amountSom: number }> {
  const url = apiAbsoluteUrl(
    `/api/storefront/${businessId}/table-reservations/${reservationId}/deposit/pay`,
  );
  const res = await api.post(url, {}, { headers: bookingHeaders() });
  return res.data;
}

export async function syncReservationDeposit(
  businessId: number,
  reservationId: number,
): Promise<{
  paymentState: "paid" | "pending" | "failed";
  duplicate?: boolean;
  reservation: TableReservationDto | null;
}> {
  const url = apiAbsoluteUrl(
    `/api/storefront/${businessId}/table-reservations/${reservationId}/deposit/sync`,
  );
  const res = await api.post(url, {}, { headers: bookingHeaders() });
  return res.data;
}

export async function fetchReservationPreorderContext(
  businessId: number,
  reservationId: number,
): Promise<{
  reservation: {
    id: number;
    tableName: string;
    reservedAt: string;
    partySize: number | null;
    status: string;
    hasPreorder: boolean;
  };
}> {
  const url = apiAbsoluteUrl(
    `/api/storefront/${businessId}/table-reservations/${reservationId}/preorder-context`,
  );
  const res = await api.get(url, { headers: bookingHeaders() });
  return res.data;
}

export async function fetchMerchantReservations(
  businessId: number,
  filter: "upcoming" | "active" | "cancelled" | "completed",
): Promise<{ reservations: TableReservationDto[] }> {
  const url = apiAbsoluteUrl(
    `/api/merchant/table-reservations?filter=${filter}&businessId=${businessId}`,
  );
  const res = await api.get(url, { headers: bookingHeaders() });
  return res.data;
}

export async function patchMerchantReservation(
  businessId: number,
  id: number,
  status: string,
): Promise<{ reservation: TableReservationDto }> {
  const url = apiAbsoluteUrl(
    `/api/merchant/table-reservations/${id}?businessId=${businessId}`,
  );
  const res = await api.patch(url, { status }, { headers: bookingHeaders() });
  return res.data;
}
