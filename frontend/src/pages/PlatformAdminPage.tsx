import { useCallback, useEffect, useState } from "react";
import { getTelegramWebApp } from "../utils/telegram";
import { getWebAppUserId } from "../utils/adminAccess";
import {
  fetchPlatformAdminBusinesses,
  fetchPlatformAdminRequests,
  postPlatformAdminApprove,
  postPlatformAdminDisable,
  postPlatformAdminExtend,
  postPlatformAdminPurgeBusiness,
  postPlatformAdminReject,
  type PlatformAdminBusinessDTO,
  type PlatformAdminRequestDTO,
} from "../services/platformAdminApi";

function statusRu(status: string): string {
  const u = status.toUpperCase();
  if (u === "PENDING") return "Ожидает";
  if (u === "APPROVED") return "Одобрена";
  if (u === "REJECTED") return "Отклонена";
  return status;
}

function platformStatusRu(status: string): string {
  const map: Record<string, string> = {
    blocked: "🔒 Заблокирован",
    inactive: "🔴 Не активен",
    subscription_expired: "⏳ Подписка истекла",
    trialing: "🟡 Пробный период",
    active: "🟢 Активен",
    past_due: "⚠️ Просрочен платёж",
    canceled: "⛔ Отменён",
    expired: "⏹ Истёк",
  };
  return map[status] ?? status;
}

function businessStatusLabel(b: PlatformAdminBusinessDTO): string {
  if (b.isBlocked) return "заблокирован";
  if (!b.isActive) return "неактивен";
  return platformStatusRu(b.status);
}

function webhookListLabel(ws: PlatformAdminBusinessDTO["webhookStatus"]): string {
  return ws === "OK" ? "Webhook: ✅ OK" : "Webhook: ❌ ошибка";
}

function isForbiddenAdminError(e: unknown): boolean {
  return (
    e instanceof Error &&
    ((e as Error & { status?: number }).status === 403 ||
      e.message === "Нет доступа")
  );
}

function formatIsoDate(iso: string | null): string {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Mini App `/platform-admin`: доступ решает только сервер (`ADMIN_IDS` + 403). */
export default function PlatformAdminPage() {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;
  const userId =
    user != null && typeof user.id === "number" && Number.isFinite(user.id)
      ? user.id
      : getWebAppUserId();

  const hasTelegramUser = Number.isFinite(userId) && userId > 0;

  const [accessForbidden, setAccessForbidden] = useState(false);
  const [rows, setRows] = useState<PlatformAdminRequestDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const [businesses, setBusinesses] = useState<PlatformAdminBusinessDTO[]>(
    [],
  );
  const [bizLoading, setBizLoading] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [bizBusyKey, setBizBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!hasTelegramUser) return;
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchPlatformAdminRequests(userId);
      setRows(data);
      setAccessForbidden(false);
    } catch (e) {
      if (isForbiddenAdminError(e)) {
        setAccessForbidden(true);
        setRows([]);
      } else {
        setListError(e instanceof Error ? e.message : "Ошибка загрузки");
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [hasTelegramUser, userId]);

  const reloadBusinesses = useCallback(async () => {
    if (!hasTelegramUser || accessForbidden) return;
    setBizLoading(true);
    setBizError(null);
    try {
      const data = await fetchPlatformAdminBusinesses({
        telegramId: userId,
        search: searchApplied.trim() !== "" ? searchApplied : undefined,
      });
      setBusinesses(data);
    } catch (e) {
      if (isForbiddenAdminError(e)) {
        setAccessForbidden(true);
        setBusinesses([]);
      } else {
        setBizError(e instanceof Error ? e.message : "Ошибка загрузки");
        setBusinesses([]);
      }
    } finally {
      setBizLoading(false);
    }
  }, [hasTelegramUser, accessForbidden, userId, searchApplied]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void reload();
  }, [reload]);

  useEffect(() => {
    void reloadBusinesses();
  }, [reloadBusinesses]);

  const busy = actionId !== null;

  async function approve(id: number) {
    if (accessForbidden || !hasTelegramUser) return;
    setActionId(id);
    try {
      await postPlatformAdminApprove({
        telegramId: userId,
        requestId: id,
      });
      await reload();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setListError(e instanceof Error ? e.message : "Ошибка одобрения");
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: number) {
    if (accessForbidden || !hasTelegramUser) return;
    setActionId(id);
    try {
      await postPlatformAdminReject({
        telegramId: userId,
        requestId: id,
      });
      await reload();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setListError(e instanceof Error ? e.message : "Ошибка отклонения");
    } finally {
      setActionId(null);
    }
  }

  function runSearch() {
    setSearchApplied(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft("");
    setSearchApplied("");
  }

  async function purgeStore(businessId: number) {
    if (accessForbidden || !hasTelegramUser) return;
    if (
      !window.confirm(
        `УДАЛИТЬ НАВСЕГДА магазин #${businessId}?\n\nБудут удалены заказы, товары, настройки, заявки с этим токеном и сам магазин из БД. Восстановление невозможно.`,
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Подтвердите ещё раз: полное удаление из базы данных без отката.",
      )
    ) {
      return;
    }
    const key = `p-${businessId}`;
    setBizBusyKey(key);
    try {
      await postPlatformAdminPurgeBusiness({ telegramId: userId, businessId });
      await reloadBusinesses();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setBizError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBizBusyKey(null);
    }
  }

  async function disableStore(businessId: number) {
    if (accessForbidden || !hasTelegramUser) return;
    if (!window.confirm(`Отключить магазин #${businessId}?`)) return;
    const key = `d-${businessId}`;
    setBizBusyKey(key);
    try {
      await postPlatformAdminDisable({ telegramId: userId, businessId });
      await reloadBusinesses();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setBizError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBizBusyKey(null);
    }
  }

  async function extendStore(businessId: number, days: 30 | 90) {
    if (accessForbidden || !hasTelegramUser) return;
    const key = `e-${businessId}-${days}`;
    setBizBusyKey(key);
    try {
      await postPlatformAdminExtend({ telegramId: userId, businessId, days });
      await reloadBusinesses();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setBizError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBizBusyKey(null);
    }
  }

  if (!hasTelegramUser) {
    return (
      <div className="min-h-full bg-slate-950 p-6 text-center text-red-300">
        <p className="font-semibold">⛔ Нет доступа</p>
        <p className="mt-2 text-sm text-slate-400">
          Откройте страницу из Telegram Mini App.
        </p>
      </div>
    );
  }

  if (accessForbidden) {
    return (
      <div className="min-h-full bg-slate-950 p-6 text-center text-red-300">
        <p className="font-semibold">Нет доступа</p>
        <p className="mt-2 text-sm text-slate-400">
          Раздел только для администратора платформы (проверка на сервере).
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 pb-12 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Платформа — админка
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Скрытый URL · только администратор
          </p>
        </header>

        <section aria-labelledby="platform-requests-heading">
          <h2
            id="platform-requests-heading"
            className="mb-3 text-lg font-medium text-white"
          >
            Заявки на магазин
          </h2>

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
                      ✅ Одобрить
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void reject(r.id)}
                      className="rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900/50 disabled:opacity-50"
                    >
                      ❌ Отклонить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="platform-shops-heading">
          <h2
            id="platform-shops-heading"
            className="mb-3 text-lg font-medium text-white"
          >
            Магазины
          </h2>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm text-slate-400">
              <span className="mb-1 block text-slate-500">Поиск (id или имя)</span>
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-emerald-600/40 focus:ring-2"
                placeholder="например 12 или Coffee"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runSearch()}
                className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
              >
                🔍 Найти
              </button>
              <button
                type="button"
                onClick={() => clearSearch()}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Сброс
              </button>
            </div>
          </div>

          {bizError ? (
            <div
              className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {bizError}
            </div>
          ) : null}

          {bizLoading ? (
            <p className="text-sm text-slate-400">Загрузка магазинов…</p>
          ) : businesses.length === 0 ? (
            <div
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400"
              role="status"
            >
              {searchApplied.trim() !== ""
                ? "Ничего не найдено."
                : "Нет магазинов в выборке."}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {businesses.map((b) => (
                <li
                  key={b.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="font-mono text-slate-400">#{b.id}</span>
                      <span className="ml-2 font-medium text-white">
                        {b.name}
                      </span>
                    </div>
                    <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-200">
                      {businessStatusLabel(b)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Подписка до:{" "}
                    <span className="text-slate-300">
                      {formatIsoDate(b.subscriptionEndsAt)}
                    </span>
                    {b.trialEndsAt != null ? (
                      <>
                        {" · "}
                        триал:{" "}
                        <span className="text-slate-300">
                          {formatIsoDate(b.trialEndsAt)}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {webhookListLabel(b.webhookStatus)}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-slate-600">
                    {b.webhookUrl != null && b.webhookUrl.trim() !== ""
                      ? b.webhookUrl.trim()
                      : "URL вебхука не задан или недоступен"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={bizBusyKey !== null}
                      onClick={() => void disableStore(b.id)}
                      className="rounded-xl border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200 transition hover:bg-red-900/40 disabled:opacity-50"
                    >
                      {bizBusyKey === `d-${b.id}` ? "…" : "❌ Отключить"}
                    </button>
                    <button
                      type="button"
                      disabled={bizBusyKey !== null}
                      onClick={() => void purgeStore(b.id)}
                      className="rounded-xl border border-rose-950 bg-rose-950/70 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-900 disabled:opacity-50"
                    >
                      {bizBusyKey === `p-${b.id}` ? "…" : "🗑 Удалить из БД"}
                    </button>
                    <button
                      type="button"
                      disabled={bizBusyKey !== null}
                      onClick={() => void extendStore(b.id, 30)}
                      className="rounded-xl bg-emerald-900/50 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-800/50 disabled:opacity-50"
                    >
                      {bizBusyKey === `e-${b.id}-30` ? "…" : "🔄 +30 дн."}
                    </button>
                    <button
                      type="button"
                      disabled={bizBusyKey !== null}
                      onClick={() => void extendStore(b.id, 90)}
                      className="rounded-xl bg-emerald-900/50 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-800/50 disabled:opacity-50"
                    >
                      {bizBusyKey === `e-${b.id}-90` ? "…" : "🔄 +90 дн."}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
