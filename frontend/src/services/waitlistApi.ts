import { api, apiAbsoluteUrl } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type WaitlistEntryDto = {
  id: number;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestNote: string | null;
  preferredAt: string | null;
  status: string;
  assignedTableId: number | null;
  tableName: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  reservationId: number | null;
  createdAt: string;
};

export type WaitlistBoardDto = {
  at: string;
  analytics: {
    waitingCount: number;
    activeInvitesCount: number;
    avgWaitMinutes: number;
    seated7d: number;
    declined7d: number;
    expired7d: number;
    left7d: number;
  };
  waiting: Array<{
    id: number;
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote: string | null;
    preferredAt: string | null;
    status: string;
    createdAt: string;
    waitMinutes: number;
  }>;
  invited: Array<{
    id: number;
    partySize: number;
    guestName: string;
    guestPhone: string;
    status: string;
    tableName: string | null;
    invitedAt: string | null;
    inviteExpiresAt: string | null;
  }>;
};

function headers(): Record<string, string> {
  return {
    ...telegramWebAppInitDataHeader(),
    "Content-Type": "application/json",
  };
}

export async function fetchWaitlistContext(
  businessId: number,
): Promise<{ supported: boolean; hasBookableTables: boolean }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/waitlist/context`);
  const res = await api.get(url, { headers: headers() });
  return res.data;
}

export async function joinWaitlist(
  businessId: number,
  body: {
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote?: string;
    preferredAt?: string;
  },
): Promise<{ entry: WaitlistEntryDto }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/waitlist`);
  const res = await api.post(url, body, { headers: headers() });
  return res.data;
}

export async function fetchMyWaitlistEntries(
  businessId: number,
): Promise<{ supported: boolean; entries: WaitlistEntryDto[]; queuePosition: number }> {
  const url = apiAbsoluteUrl(`/api/storefront/${businessId}/waitlist/mine`);
  const res = await api.get(url, { headers: headers() });
  return res.data;
}

export async function acceptWaitlistInvite(
  businessId: number,
  entryId: number,
): Promise<{ reservationId: number; entry: WaitlistEntryDto | null }> {
  const url = apiAbsoluteUrl(
    `/api/storefront/${businessId}/waitlist/${entryId}/accept`,
  );
  const res = await api.post(url, {}, { headers: headers() });
  return res.data;
}

export async function fetchMerchantWaitlist(
  businessId: number,
): Promise<WaitlistBoardDto> {
  const url = apiAbsoluteUrl(
    `/api/merchant/waitlist?businessId=${encodeURIComponent(String(businessId))}`,
  );
  const res = await api.get(url, { headers: headers() });
  return res.data;
}

export async function cancelMerchantWaitlistEntry(
  businessId: number,
  id: number,
): Promise<void> {
  const url = apiAbsoluteUrl(
    `/api/merchant/waitlist/${id}?businessId=${encodeURIComponent(String(businessId))}`,
  );
  await api.patch(url, { status: "CANCELLED" }, { headers: headers() });
}
