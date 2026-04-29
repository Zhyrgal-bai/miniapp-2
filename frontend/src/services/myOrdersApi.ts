import { api } from "./api";
import type { MyOrderRow } from "../types/myOrder";

export async function fetchMyOrders(userId: number): Promise<MyOrderRow[]> {
  const res = await api.get<MyOrderRow[]>("/orders/my", {
    params: { userId },
  });
  return Array.isArray(res.data) ? res.data : [];
}
