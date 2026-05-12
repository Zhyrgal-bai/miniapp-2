import { useEffect } from "react";
import { useAdminGateStore } from "../store/adminGate.store";
import { getWebAppUserId } from "./telegramUserId";

export { getWebAppUserId } from "./telegramUserId";

/** Локальный список из VITE (опционально, для офлайна / до ответа сервера). */
export function viteAdminIdsAllow(): boolean {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) return false;

  const rawAdminIds = import.meta.env.VITE_ADMIN_IDS;

  const ADMIN_IDS: number[] = rawAdminIds
    ? rawAdminIds.split(",").map((id) => Number(id.trim()))
    : [];

  return ADMIN_IDS.length > 0 && ADMIN_IDS.includes(userId);
}

/**
 * Админку Mini App показываем только по роли OWNER/ADMIN из GET /api/me (бэкенд валидирует).
 */
export function useAdminPanelVisible(): boolean {
  const status = useAdminGateStore((s) => s.status);
  const serverIsAdmin = useAdminGateStore((s) => s.serverIsAdmin);
  const lastHttpOk = useAdminGateStore((s) => s.lastHttpOk);

  if (status === "idle" || status === "loading") return false;
  return lastHttpOk && serverIsAdmin;
}

/** Опрос `/check-admin`, пока не появится Telegram user id (до ~5 с). */
export function useAdminAccessBootstrap(): void {
  const refresh = useAdminGateStore((s) => s.refresh);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      for (let i = 0; i < 24 && !cancelled; i++) {
        await refresh();
        if (getWebAppUserId() > 0) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
}
