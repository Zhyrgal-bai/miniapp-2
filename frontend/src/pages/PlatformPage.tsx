import { useCallback, useEffect, useState } from "react";
import { getTelegramWebApp } from "../utils/telegram";
import {
  fetchPlatformMyBusinesses,
  submitPlatformRegisterRequest,
  type PlatformMyBusinessDTO,
} from "../services/platformApi";

/** Платформа Mini App (главный бот клиенты + позже админ); витрины магазинов не трогаем. */
export default function PlatformPage() {
  const [businesses, setBusinesses] = useState<PlatformMyBusinessDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  const load = useCallback(async () => {
    const tg = getTelegramWebApp();
    const user = tg?.initDataUnsafe?.user;
    const telegramId =
      user != null && typeof user.id === "number" && Number.isFinite(user.id)
        ? user.id
        : NaN;

    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      setError("Откройте приложение из Telegram Mini App.");
      setBusinesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPlatformMyBusinesses({ telegramId });
      setBusinesses(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void load();
  }, [load]);

  const tgUserId = getTelegramWebApp()?.initDataUnsafe?.user?.id;

  const openModal = () => {
    setSubmitError(null);
    setSuccessFlash(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError(null);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const uid =
      typeof tgUserId === "number" && Number.isFinite(tgUserId) && tgUserId > 0
        ? tgUserId
        : NaN;

    if (!Number.isFinite(uid)) {
      setSubmitError("Нет данных пользователя Telegram. Откройте из Mini App.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitPlatformRegisterRequest({
        storeName: storeName.trim(),
        botToken: botToken.trim(),
        phone: phone.trim(),
        telegramId: uid,
      });
      setStoreName("");
      setBotToken("");
      setPhone("");
      setModalOpen(false);
      setSuccessFlash(true);
      window.setTimeout(() => setSuccessFlash(false), 5000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6 pb-28">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            🚀 Мои магазины
          </h1>
        </header>

        {successFlash ? (
          <p
            className="rounded-xl border border-emerald-900/60 bg-emerald-950/50 px-4 py-3 text-center text-sm text-emerald-200"
            role="status"
          >
            Заявка отправлена ✅
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : error ? (
          <div
            className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : businesses.length === 0 ? (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400"
            role="status"
          >
            У вас пока нет магазинов, где вы указаны как владелец.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {businesses.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4 shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-medium text-white">{b.name}</h2>
                  <p className="text-sm text-slate-300">
                    {b.isActive ? "🟢 Активен" : "🔴 Не активен"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 p-4 backdrop-blur sm:p-6">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={openModal}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 active:bg-emerald-700"
          >
            + Создать магазин
          </button>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-labelledby="platform-register-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="platform-register-title"
                className="text-lg font-semibold text-white"
              >
                Заявка на магазин
              </h2>
              <button
                type="button"
                className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={closeModal}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="platform-store-name"
                  className="mb-1 block text-sm text-slate-400"
                >
                  Название магазина
                </label>
                <input
                  id="platform-store-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="organization"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="platform-bot-token"
                  className="mb-1 block text-sm text-slate-400"
                >
                  Токен бота (BotFather)
                </label>
                <input
                  id="platform-bot-token"
                  type="password"
                  autoComplete="off"
                  required
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="platform-phone"
                  className="mb-1 block text-sm text-slate-400"
                >
                  Телефон
                </label>
                <input
                  id="platform-phone"
                  type="tel"
                  required
                  inputMode="tel"
                  placeholder="+996XXXXXXXXX или 0XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Формат КР: +996 и 9 цифр, или 0 и 9 цифр
                </p>
              </div>

              {submitError ? (
                <p className="text-sm text-red-300" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? "Отправка…" : "Отправить заявку"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
