import { apiAbsoluteUrl } from "./api";
import { adminFetchJson, adminFetchVoid } from "./adminRequest";

export type DiningTableShape = "SQUARE" | "RECTANGLE" | "CIRCLE" | "VIP";
export type DiningTableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "SOON_OCCUPIED";

export type DiningTableDto = {
  id: number;
  name: string;
  seats: number;
  shape: DiningTableShape;
  description: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  status: DiningTableStatus;
  liveStatus?: string;
  qrToken?: string | null;
  sortOrder: number;
  isActive: boolean;
  nextReservation: { reservedAt: string; guestName: string | null } | null;
};

export type DiningTablesPayload = {
  supported: boolean;
  businessType?: string;
  tables: DiningTableDto[];
};

export async function fetchMerchantDiningTables(
  businessId: number,
): Promise<DiningTablesPayload> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/dining-tables"));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson<DiningTablesPayload>(url.toString(), {
    method: "GET",
    businessId,
    json: false,
  });
}

export async function createMerchantDiningTable(
  businessId: number,
  body: {
    name: string;
    seats: number;
    shape?: DiningTableShape;
    description?: string;
    posX?: number;
    posY?: number;
    width?: number;
    height?: number;
    status?: DiningTableStatus;
  },
): Promise<{ table: DiningTableDto }> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/dining-tables"));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson(url.toString(), {
    method: "POST",
    businessId,
    body: JSON.stringify(body),
  });
}

export async function updateMerchantDiningTable(
  businessId: number,
  id: number,
  body: Partial<{
    name: string;
    seats: number;
    shape: DiningTableShape;
    description: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    status: DiningTableStatus;
  }>,
): Promise<{ table: DiningTableDto }> {
  const url = new URL(apiAbsoluteUrl(`/api/merchant/dining-tables/${id}`));
  url.searchParams.set("shop", String(businessId));
  return adminFetchJson(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify(body),
  });
}

export async function saveMerchantDiningTableLayout(
  businessId: number,
  tables: Array<{ id: number; posX: number; posY: number; width: number; height: number }>,
): Promise<void> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/dining-tables/layout"));
  url.searchParams.set("shop", String(businessId));
  await adminFetchVoid(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify({ tables }),
  });
}

export async function deleteMerchantDiningTable(
  businessId: number,
  id: number,
): Promise<void> {
  const url = new URL(apiAbsoluteUrl(`/api/merchant/dining-tables/${id}`));
  url.searchParams.set("shop", String(businessId));
  await adminFetchVoid(url.toString(), {
    method: "DELETE",
    businessId,
  });
}
