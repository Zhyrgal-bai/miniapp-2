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
 * Показывать админку: при успешном ответе сервера — только `isAdmin` с бэка;
 * если сервер недоступен или Telegram ещё не отдал userId — допускаем VITE_ADMIN_IDS.
 */
export function useAdminPanelVisible(): boolean {
  const status = useAdminGateStore((s) => s.status);
  const serverIsAdmin = useAdminGateStore((s) => s.serverIsAdmin);
  const lastHttpOk = useAdminGateStore((s) => s.lastHttpOk);
  const vite = viteAdminIdsAllow();

  if (status === "idle" || status === "loading") return vite;
  if (lastHttpOk) return serverIsAdmin;
  return vite;
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
