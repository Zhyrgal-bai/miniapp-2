import { apiAbsoluteUrl } from "./api";

/** Контракт с `GET /my-businesses` (синхрон с `merchantDashboard.ts` на сервере). */
export type MerchantBusinessCardDTO = {
  id: number;
  name: string;
  isActive: boolean;
  role: string;
  subscriptionStatus: string;
  billingPlan: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  accessState: "active" | "pay_required" | "paused";
};

export async function fetchMerchantBusinesses(params: {
  telegramId: number;
}): Promise<MerchantBusinessCardDTO[]> {
  const id = encodeURIComponent(String(params.telegramId));
  const res = await fetch(
    apiAbsoluteUrl(`/my-businesses?telegramId=${id}`),
    { method: "GET", credentials: "omit" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { businesses?: MerchantBusinessCardDTO[] };
  return Array.isArray(data.businesses) ? data.businesses : [];
}
