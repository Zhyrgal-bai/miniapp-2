import { create } from "zustand";
import { getWebAppUserId } from "../utils/telegramUserId";
import { API_BASE_URL } from "../services/api";

type AdminGateStatus = "idle" | "loading" | "ready";

type AdminGateState = {
  status: AdminGateStatus;
  serverIsAdmin: boolean;
  /** true если ответ /check-admin пришёл с HTTP 200 (тогда доверяем serverIsAdmin). */
  lastHttpOk: boolean;
  refresh: () => Promise<void>;
};

export const useAdminGateStore = create<AdminGateState>((set) => ({
  status: "idle",
  serverIsAdmin: false,
  lastHttpOk: false,

  refresh: async () => {
    const userId = getWebAppUserId();
    if (!Number.isFinite(userId) || userId <= 0) {
      set({ status: "idle", serverIsAdmin: false, lastHttpOk: false });
      return;
    }

    set({ status: "loading" });
    try {
      const res = await fetch(`${API_BASE_URL}/check-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = (await res.json().catch(() => ({}))) as { isAdmin?: boolean };
      set({
        status: "ready",
        lastHttpOk: res.ok,
        serverIsAdmin: res.ok ? !!j.isAdmin : false,
      });
    } catch {
      set({
        status: "ready",
        lastHttpOk: false,
        serverIsAdmin: false,
      });
    }
  },
}));
