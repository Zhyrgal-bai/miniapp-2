import { apiAbsoluteUrl } from "./api";
import { adminFetchJson } from "./adminRequest";

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
  const data = await adminFetchJson<{ businesses?: MerchantBusinessCardDTO[] }>(
    apiAbsoluteUrl("/my-businesses"),
    { method: "GET", json: false },
  );
  return Array.isArray(data.businesses) ? data.businesses : [];
}
