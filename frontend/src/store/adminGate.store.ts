import { create } from "zustand";
import { getWebAppUserId } from "../utils/telegramUserId";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";
import { API_BASE_URL } from "../services/api";

type AdminGateStatus = "idle" | "loading" | "ready";

type AdminGateState = {
  status: AdminGateStatus;
  /** OWNER / ADMIN в текущем `shop`: только если ответ бэкенда успешный. */
  serverIsAdmin: boolean;
  /** Роль текущего пользователя из GET /api/me (OWNER | ADMIN | CLIENT). */
  merchantRole: string | null;
  /** Эффективные права для ADMIN (OWNER — полный список с сервера). */
  merchantPermissions: string[] | null;
  lastHttpOk: boolean;
  refresh: (businessId?: number | null) => Promise<void>;
};

export const useAdminGateStore = create<AdminGateState>((set) => ({
  status: "idle",
  serverIsAdmin: false,
  merchantRole: null,
  merchantPermissions: null,
  lastHttpOk: false,

  refresh: async (businessId?: number | null) => {
    const userId = getWebAppUserId();
    if (!Number.isFinite(userId) || userId <= 0) {
      set({
        status: "idle",
        serverIsAdmin: false,
        merchantRole: null,
        merchantPermissions: null,
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
        merchantPermissions: null,
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
    headers: telegramWebAppInitDataHeader(),
  });
      const j = (await res.json().catch(() => ({}))) as {
        role?: string;
        permissions?: string[];
      };
      const admin =
        res.ok &&
        (j.role === "OWNER" ||
          j.role === "ADMIN" ||
          j.role === "MANAGER" ||
          j.role === "SUPPORT");
      const r =
        res.ok && typeof j.role === "string" ? j.role : null;
      const perms =
        res.ok && Array.isArray(j.permissions)
          ? j.permissions.filter((p): p is string => typeof p === "string")
          : null;
      set({
        status: "ready",
        lastHttpOk: res.ok,
        merchantRole: r,
        merchantPermissions: perms,
        serverIsAdmin: admin,
      });
    } catch {
      set({
        status: "ready",
        lastHttpOk: false,
        serverIsAdmin: false,
        merchantRole: null,
        merchantPermissions: null,
      });
    }
  },
}));
