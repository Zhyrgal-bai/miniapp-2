import { apiAbsoluteUrl } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

/** Контракт с `GET /my-businesses` (синхрон с `merchantDashboard.ts` на сервере). */
export type MerchantBusinessCardDTO = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  role: string;
  subscriptionStatus: string;
  billingPlan: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  accessState: "active" | "blocked" | "pay_required" | "paused";
};

export async function fetchMerchantBusinesses(): Promise<MerchantBusinessCardDTO[]> {
  const initHdr = telegramWebAppInitDataHeader();
  const res = await fetch(apiAbsoluteUrl("/my-businesses"), {
    method: "GET",
    credentials: "omit",
    headers: {
      ...initHdr,
    },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { businesses?: MerchantBusinessCardDTO[] };
  return Array.isArray(data.businesses) ? data.businesses : [];
}
