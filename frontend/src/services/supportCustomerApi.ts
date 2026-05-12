import { api } from "./api";
import type { MyOrderRow } from "../types/myOrder";

function tenantParams(userId: number, shop: string) {
  return {
    userId,
    shop,
    businessId: shop,
  };
}

export type SupportTicketType =
  | "GENERAL"
  | "DELIVERY"
  | "QUALITY"
  | "RETURN"
  | "EXCHANGE"
  | "CANCEL_REQUEST"
  | "ADDRESS_CHANGE"
  | "TRACKING"
  | "OTHER";

export type SupportMessageRow = {
  id?: number;
  senderType: string;
  text: string;
  attachments?: unknown;
  createdAt?: string;
};

export type SupportTicketRow = {
  id: number;
  status: string;
  type: string;
  orderId: number;
  messages?: SupportMessageRow[];
  order?: MyOrderRow;
};

export type ReturnReason = "SIZE" | "DAMAGE" | "WRONG_ITEM" | "QUALITY" | "OTHER";

export type ReturnRequestRow = {
  id: number;
  status: string;
  reason: string;
  comment?: string | null;
  photos?: unknown;
  orderItemId?: number | null;
};

export async function fetchMyOrderDetail(
  userId: number,
  shop: string,
  orderId: number
): Promise<MyOrderRow> {
  const res = await api.get<MyOrderRow>(`/orders/my/${orderId}`, {
    params: tenantParams(userId, shop),
  });
  return res.data;
}

export async function fetchSupportTicketsForOrder(
  userId: number,
  shop: string,
  orderId: number
): Promise<SupportTicketRow[]> {
  const res = await api.get<SupportTicketRow[]>("/support/tickets", {
    params: { ...tenantParams(userId, shop), orderId },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createSupportTicket(
  userId: number,
  shop: string,
  body: { orderId: number; type: SupportTicketType; text?: string }
): Promise<SupportTicketRow> {
  const res = await api.post<SupportTicketRow>("/support/tickets", body, {
    params: tenantParams(userId, shop),
  });
  return res.data;
}

export async function fetchSupportTicket(
  userId: number,
  shop: string,
  ticketId: number
): Promise<SupportTicketRow> {
  const res = await api.get<SupportTicketRow>(`/support/tickets/${ticketId}`, {
    params: tenantParams(userId, shop),
  });
  return res.data;
}

export async function postSupportTicketMessage(
  userId: number,
  shop: string,
  ticketId: number,
  text: string,
  attachments?: unknown[]
): Promise<SupportTicketRow> {
  const res = await api.post<SupportTicketRow>(
    `/support/tickets/${ticketId}/messages`,
    { text, attachments: attachments ?? [] },
    { params: tenantParams(userId, shop) }
  );
  return res.data;
}

export async function uploadSupportPhoto(
  userId: number,
  shop: string,
  orderId: number,
  file: File
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("orderId", String(orderId));
  form.append("userId", String(userId));
  const res = await api.post<{ url: string }>("/support/upload", form, {
    params: tenantParams(userId, shop),
  });
  return res.data;
}

export async function fetchReturnRequestsForOrder(
  userId: number,
  shop: string,
  orderId: number
): Promise<ReturnRequestRow[]> {
  const res = await api.get<ReturnRequestRow[]>("/support/returns", {
    params: { ...tenantParams(userId, shop), orderId },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createReturnRequest(
  userId: number,
  shop: string,
  body: {
    orderId: number;
    orderItemId?: number | null;
    reason: ReturnReason;
    comment?: string;
    photos?: string[];
  }
): Promise<ReturnRequestRow> {
  const res = await api.post<ReturnRequestRow>("/support/returns", body, {
    params: tenantParams(userId, shop),
  });
  return res.data;
}
