import { useCallback, useEffect, useState } from "react";
import { getTelegramWebApp } from "../utils/telegram";
import {
  fetchPlatformAdminRequests,
  postPlatformAdminApprove,
  postPlatformAdminReject,
  type PlatformAdminRequestDTO,
} from "../services/platformAdminApi";

/** Задайте в `frontend/.env`: VITE_PLATFORM_ADMIN_TELEGRAM_ID=<ваш Telegram user id>. */
const ADMIN_ID = Number(import.meta.env.VITE_PLATFORM_ADMIN_TELEGRAM_ID ?? "");

function statusRu(status: string): string {
  const u = status.toUpperCase();
  if (u === "PENDING") return "Ожидает";
  if (u === "APPROVED") return "Одобрена";
  if (u === "REJECTED") return "Отклонена";
  return status;
}

/** Админка платформы: только главный ADMIN (не клиентские магазины). */
export default function PlatformAdminPage() {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;
  const userId =
    user != null && typeof user.id === "number" && Number.isFinite(user.id)
      ? user.id
      : NaN;

  const configured =
    Number.isFinite(ADMIN_ID) &&
    ADMIN_ID > 0 &&
    Number.isSafeInteger(ADMIN_ID);
  const accessAllowed =
    configured && Number.isFinite(userId) && userId > 0 && userId === ADMIN_ID;

  const [rows, setRows] = useState<PlatformAdminRequestDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!accessAllowed || !configured) return;
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchPlatformAdminRequests(ADMIN_ID);
      setRows(data);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Ошибка загрузки");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessAllowed, configured]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void reload();
  }, [reload]);

  const busy = actionId !== null;

  async function approve(id: number) {
    if (!accessAllowed) return;
    setActionId(id);
    try {
      await postPlatformAdminApprove({
        telegramId: ADMIN_ID,
        requestId: id,
      });
      await reload();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Ошибка одобрения");
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: number) {
    if (!accessAllowed) return;
    setActionId(id);
    try {
      await postPlatformAdminReject({
        telegramId: ADMIN_ID,
        requestId: id,
      });
      await reload();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Ошибка отклонения");
    } finally {
      setActionId(null);
    }
  }

  if (!configured) {
    return (
      <div className="min-h-full bg-slate-950 p-6 text-center text-red-300">
        <p className="font-semibold">Access denied</p>
        <p className="mt-2 text-sm text-slate-400">
          Задайте VITE_PLATFORM_ADMIN_TELEGRAM_ID в frontend/.env
        </p>
      </div>
    );
  }

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <div className="min-h-full bg-slate-950 p-6 text-center text-red-300">
        <p className="font-semibold">Access denied</p>
        <p className="mt-2 text-sm text-slate-400">
          Откройте страницу из Telegram Mini App.
        </p>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-full bg-slate-950 p-6 text-center text-red-300">
        <p className="font-semibold">Access denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 pb-12 text-slate-100">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Платформа — заявки
          </h1>
          <p className="mt-1 text-sm text-slate-400">Только администратор</p>
        </header>

        {listError ? (
          <div
            className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {listError}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : rows.length === 0 ? (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400"
            role="status"
          >
            Нет заявок в статусе «ожидает».
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-white">#{r.id}</span>
                    <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-200">
                      {statusRu(r.status)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">{r.storeName}</p>
                  <p className="font-mono text-sm text-slate-400">{r.phone}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void approve(r.id)}
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    ✅ Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reject(r.id)}
                    className="rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900/50 disabled:opacity-50"
                  >
                    ❌ Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
