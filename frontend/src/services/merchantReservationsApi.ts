import { apiAbsoluteUrl } from "./api";
import { adminFetchJson } from "./adminRequest";
import type { TableReservationDto } from "./tableBookingApi";

export type ReservationFilter = "upcoming" | "active" | "cancelled" | "completed";

export async function fetchMerchantReservationsAdmin(
  businessId: number,
  filter: ReservationFilter,
): Promise<{ supported: boolean; reservations: TableReservationDto[] }> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/table-reservations"));
  url.searchParams.set("shop", String(businessId));
  url.searchParams.set("filter", filter);
  return adminFetchJson(url.toString(), {
    method: "GET",
    businessId,
    json: false,
  });
}

export async function updateMerchantReservationStatus(
  businessId: number,
  id: number,
  status: string,
): Promise<{ reservation: TableReservationDto }> {
  const url = apiAbsoluteUrl(`/api/merchant/table-reservations/${id}?shop=${businessId}`);
  return adminFetchJson(url, {
    method: "PATCH",
    businessId,
    body: JSON.stringify({ status }),
  });
}
