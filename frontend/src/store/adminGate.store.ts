import { create } from "zustand";
import { getWebAppUserId } from "../utils/telegramUserId";
import { API_BASE_URL } from "../services/api";

type AdminGateStatus = "idle" | "loading" | "ready";

type AdminGateState = {
  status: AdminGateStatus;
  /** OWNER / ADMIN в текущем `shop`: только если ответ бэкенда успешный. */
  serverIsAdmin: boolean;
  /** Роль текущего пользователя из GET /api/me (OWNER | ADMIN | CLIENT). */
  merchantRole: string | null;
  lastHttpOk: boolean;
  refresh: (businessId?: number | null) => Promise<void>;
};

export const useAdminGateStore = create<AdminGateState>((set) => ({
  status: "idle",
  serverIsAdmin: false,
  merchantRole: null,
  lastHttpOk: false,

  refresh: async (businessId?: number | null) => {
    const userId = getWebAppUserId();
    if (!Number.isFinite(userId) || userId <= 0) {
      set({
        status: "idle",
        serverIsAdmin: false,
        merchantRole: null,
        lastHttpOk: false,
      });
      return;
    }

    if (
      businessId == null ||
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      set({
        status: "ready",
        serverIsAdmin: false,
        merchantRole: null,
        lastHttpOk: false,
      });
      return;
    }

    set({ status: "loading" });
    try {
      const qs = new URLSearchParams({
        userId: String(userId),
        shop: String(businessId),
      });
      const res = await fetch(`${API_BASE_URL}/api/me?${qs.toString()}`, {
        method: "GET",
      });
      const j = (await res.json().catch(() => ({}))) as {
        role?: string;
      };
      const admin =
        res.ok &&
        (j.role === "OWNER" || j.role === "ADMIN");
      const r =
        res.ok && typeof j.role === "string" ? j.role : null;
      set({
        status: "ready",
        lastHttpOk: res.ok,
        merchantRole: r,
        serverIsAdmin: admin,
      });
    } catch {
      set({
        status: "ready",
        lastHttpOk: false,
        serverIsAdmin: false,
        merchantRole: null,
      });
    }
  },
}));
