import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArchaHeader } from "../components/archa/ArchaHeader";
import { archa } from "../components/archa/archaUi";
import { getTelegramWebApp } from "../utils/telegram";
import { getWebAppUserId } from "../utils/adminAccess";
import {
  fetchPlatformAdminBusinesses,
  fetchPlatformAdminRequests,
  postPlatformAdminApprove,
  postPlatformAdminDisable,
  postPlatformAdminEnable,
  postPlatformAdminExtend,
  postPlatformAdminPurgeBusiness,
  postPlatformAdminReject,
  postPlatformAdminRestartDynamicBot,
  postPlatformAdminUnblock,
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

function adminShopRunBadge(b: PlatformAdminBusinessDTO): {
  label: string;
  className: string;
} {
  if (b.isBlocked) {
    return {
      label: "⛔ Заблокирован",
      className:
        "shrink-0 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-medium text-yellow-400",
    };
  }
  if (!b.isActive) {
    return {
      label: "Отключён",
      className:
        "shrink-0 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400",
    };
  }
  return {
    label: "Активен",
    className:
      "shrink-0 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-400",
  };
}

/** Mini App `/platform-admin`: доступ решает только сервер (`ADMIN_IDS` + 403). */
export default function PlatformAdminPage() {
  const userId = getWebAppUserId();

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
  const [bizSuccessMsg, setBizSuccessMsg] = useState<string | null>(null);

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
    setBizSuccessMsg(null);
    setSearchApplied(searchDraft.trim());
  }

  function clearSearch() {
    setBizSuccessMsg(null);
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
    setBizSuccessMsg(null);
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

  async function enableStore(b: Pick<PlatformAdminBusinessDTO, "id" | "isBlocked" | "isActive">) {
    if (accessForbidden || !hasTelegramUser) return;
    const key = `y-${b.id}`;
    setBizBusyKey(key);
    setBizSuccessMsg(null);
    try {
      if (b.isBlocked) {
        await postPlatformAdminUnblock({ telegramId: userId, businessId: b.id });
        setBizSuccessMsg("Магазин разблокирован и включён");
      } else if (!b.isActive) {
        await postPlatformAdminEnable({ telegramId: userId, businessId: b.id });
        setBizSuccessMsg("Магазин включён");
      }
      await reloadBusinesses();
    } catch (e) {
      if (isForbiddenAdminError(e)) setAccessForbidden(true);
      else setBizError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBizBusyKey(null);
    }
  }

  async function restartDynamicBot(businessId: number) {
    if (accessForbidden || !hasTelegramUser) return;
    const key = `r-${businessId}`;
    setBizBusyKey(key);
    setBizSuccessMsg(null);
    try {
      await postPlatformAdminRestartDynamicBot({
        telegramId: userId,
        businessId,
      });
      await reloadBusinesses();
      setBizSuccessMsg("Клиентский бот перезапущен (webhook обновлён)");
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
    setBizSuccessMsg(null);
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
    setBizSuccessMsg(null);
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
      <div
        className={`${archa.pageRoot} flex flex-col items-center justify-center gap-4 p-8 text-center`}
      >
        <img
          src="/674440574_18101674030793392_828162833995675842_n.jpg"
          alt=""
          className="h-14 w-14 rounded-2xl border border-white/[0.08] opacity-90"
        />
        <p className="font-semibold text-red-300">⛔ Нет доступа</p>
        <p className={`max-w-xs text-sm ${archa.textMuted}`}>
          Откройте страницу из Telegram Mini App.
        </p>
      </div>
    );
  }

  if (accessForbidden) {
    return (
      <div
        className={`${archa.pageRoot} flex flex-col items-center justify-center gap-4 p-8 text-center`}
      >
        <img
          src="/674440574_18101674030793392_828162833995675842_n.jpg"
          alt=""
          className="h-14 w-14 rounded-2xl border border-white/[0.08] opacity-90"
        />
        <p className="font-semibold text-red-300">Нет доступа</p>
        <p className={`max-w-xs text-sm ${archa.textMuted}`}>
          Раздел только для администратора платформы (проверка на сервере).
        </p>
      </div>
    );
  }

  return (
    <div className={`${archa.pageRoot} min-h-screen pb-20`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-24 pt-7 sm:px-6">
        <ArchaHeader
          subtitle="Платформа"
          secondLine="Заявки и магазины · только администратор"
        />

        <section aria-labelledby="platform-requests-heading">
          <h2 id="platform-requests-heading" className={`mb-4 ${archa.sectionTitle}`}>
            Заявки на магазин
          </h2>

          {listError ? (
            <div
              className="mb-4 rounded-2xl border border-red-500/25 bg-red-950/35 px-4 py-3 text-sm text-red-200 backdrop-blur-md"
              role="alert"
            >
              {listError}
            </div>
          ) : null}

          {loading ? (
            <p className={`text-sm ${archa.textMuted}`}>Загрузка…</p>
          ) : rows.length === 0 ? (
            <div
              className={`${archa.cardGlass} px-5 py-10 text-center text-sm ${archa.textMuted}`}
              role="status"
            >
              Нет заявок в статусе «ожидает».
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((r, i) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className={`${archa.cardGlass} ${archa.cardGlassHover} overflow-hidden p-5`}
                >
                    <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-sm text-[#9CA3AF]">
                          #{r.id}
                        </span>
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                          {statusRu(r.status)}
                        </span>
                      </div>
                      <p className="font-semibold text-[#E5E7EB]">{r.storeName}</p>
                      <p className="font-mono text-sm text-[#9CA3AF]">{r.phone}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void approve(r.id)}
                        className={`${archa.btnPrimary} !py-3 text-sm`}
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reject(r.id)}
                        className={`${archa.btnSecondary} !py-3 text-sm text-red-200 hover:border-red-400/40 hover:text-red-100`}
                      >
                        Отклонить
                      </button>
                    </div>
                  </motion.li>
                ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="platform-shops-heading">
          <h2 id="platform-shops-heading" className={`mb-4 ${archa.sectionTitle}`}>
            Магазины
          </h2>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                aria-hidden
              >
                ⌕
              </span>
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                className={archa.inputSearch}
                placeholder="ID или имя магазина…"
                aria-label="Поиск по id или имени"
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => runSearch()}
                className={`${archa.btnPrimary} !w-auto min-w-[7.5rem] !px-5 !py-3`}
              >
                Найти
              </button>
              <button
                type="button"
                onClick={() => clearSearch()}
                className={`${archa.btnSecondary} !w-auto !px-5 !py-3`}
              >
                Сброс
              </button>
            </div>
          </div>

          {bizError ? (
            <div
              className="mb-4 rounded-2xl border border-red-500/25 bg-red-950/35 px-4 py-3 text-sm text-red-200 backdrop-blur-md"
              role="alert"
            >
              {bizError}
            </div>
          ) : null}

          {bizSuccessMsg ? (
            <div
              className="mb-4 rounded-2xl border border-[#22C55E]/25 bg-[#22C55E]/10 px-4 py-3 text-sm text-[#86EFAC] backdrop-blur-md"
              role="status"
            >
              {bizSuccessMsg}
            </div>
          ) : null}

          {bizLoading ? (
            <p className={`text-sm ${archa.textMuted}`}>Загрузка магазинов…</p>
          ) : businesses.length === 0 ? (
            <div
              className={`${archa.cardGlass} px-5 py-12 text-center text-sm ${archa.textMuted}`}
              role="status"
            >
              {searchApplied.trim() !== ""
                ? "Ничего не найдено."
                : "Нет магазинов в выборке."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {businesses.map((b, index) => {
                const run = adminShopRunBadge(b);
                return (
                  <motion.li
                    key={b.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.28,
                      delay: index * 0.03,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`${archa.cardGlass} ${archa.cardGlassHover} flex flex-col p-4 sm:p-5`}
                  >
                    <div className="flex gap-3">
                      <img
                        src="/674440574_18101674030793392_828162833995675842_n.jpg"
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl border border-white/[0.08] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-base font-bold text-[#E5E7EB]">
                            {b.name}
                          </h3>
                          <span className={run.className}>{run.label}</span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">
                          #{b.id}
                        </p>
                      </div>
                    </div>
                    <p className={`mt-3 text-xs leading-relaxed ${archa.textMuted}`}>
                      Подписка до:{" "}
                      <span className="text-[#E5E7EB]">
                        {formatIsoDate(b.subscriptionEndsAt)}
                      </span>
                      {b.trialEndsAt != null ? (
                        <>
                          {" · "}
                          триал:{" "}
                          <span className="text-[#E5E7EB]">
                            {formatIsoDate(b.trialEndsAt)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className={`mt-1 text-xs ${archa.textMuted}`}>
                      {webhookListLabel(b.webhookStatus)}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[10px] leading-relaxed text-[#9CA3AF]/80">
                      {b.webhookUrl != null && b.webhookUrl.trim() !== ""
                        ? b.webhookUrl.trim()
                        : "URL вебхука не задан или недоступен"}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                      {!b.isActive || b.isBlocked ? (
                        <button
                          type="button"
                          title={
                            b.isBlocked
                              ? "Разблокировать и включить магазин"
                              : "Включить магазин"
                          }
                          aria-label="Включить магазин"
                          disabled={bizBusyKey !== null}
                          onClick={() => void enableStore(b)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#22C55E] px-3 text-xs font-semibold text-black transition hover:bg-[#16A34A] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                        >
                          {bizBusyKey === `y-${b.id}` ? "…" : "🟢 Включить"}
                        </button>
                      ) : null}
                      {b.isActive && !b.isBlocked ? (
                        <button
                          type="button"
                          title="Обновить вебхук и процесс бота на сервере"
                          aria-label="Перезапуск клиентского бота"
                          disabled={bizBusyKey !== null}
                          onClick={() => void restartDynamicBot(b.id)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/45 bg-sky-950/35 px-3 text-xs font-semibold text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-950/50 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                        >
                          {bizBusyKey === `r-${b.id}` ? "…" : "🔄 Бот"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Отключить магазин"
                        aria-label="Отключить магазин"
                        disabled={bizBusyKey !== null}
                        onClick={() => void disableStore(b.id)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-950/40 px-3 text-xs font-semibold text-red-200 transition hover:border-red-400/55 hover:bg-red-950/55 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                      >
                        {bizBusyKey === `d-${b.id}` ? "…" : "🔴 Выкл"}
                      </button>
                      <button
                        type="button"
                        title="Удалить из БД навсегда"
                        aria-label="Удалить магазин из базы"
                        disabled={bizBusyKey !== null}
                        onClick={() => void purgeStore(b.id)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#9CA3AF]/35 bg-[#111827]/70 px-3 text-xs font-semibold text-[#E5E7EB] transition hover:border-red-400/35 hover:bg-red-950/25 hover:text-red-200 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                      >
                        {bizBusyKey === `p-${b.id}` ? "…" : "🗑"}
                      </button>
                      <button
                        type="button"
                        title="Продлить на 30 дней"
                        aria-label="Плюс 30 дней подписки"
                        disabled={bizBusyKey !== null}
                        onClick={() => void extendStore(b.id, 30)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-[#111827]/80 px-3 text-xs font-semibold tabular-nums text-[#E5E7EB] transition hover:border-[#22C55E]/40 hover:bg-[#111827] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                      >
                        {bizBusyKey === `e-${b.id}-30` ? "…" : "+30"}
                      </button>
                      <button
                        type="button"
                        title="Продлить на 90 дней"
                        aria-label="Плюс 90 дней подписки"
                        disabled={bizBusyKey !== null}
                        onClick={() => void extendStore(b.id, 90)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-[#111827]/80 px-3 text-xs font-semibold tabular-nums text-[#E5E7EB] transition hover:border-[#22C55E]/40 hover:bg-[#111827] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] sm:px-4 sm:text-sm"
                      >
                        {bizBusyKey === `e-${b.id}-90` ? "…" : "+90"}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
