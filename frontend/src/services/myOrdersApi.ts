import { api } from "./api";
import type { MyOrderRow } from "../types/myOrder";

export async function fetchMyOrders(
  userId: number,
  shop?: string
): Promise<MyOrderRow[]> {
  const params: Record<string, string | number> = { userId };
  if (shop && /^\d+$/.test(shop)) params.shop = shop;
  const res = await api.get<MyOrderRow[]>("/orders/my", { params });
  return Array.isArray(res.data) ? res.data : [];
}
