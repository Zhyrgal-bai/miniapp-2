import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { fetchPlatformAdminRequests } from "../services/platformAdminApi";
import {
  fetchPlatformMyBusinesses,
  fetchPlatformStoreSettings,
  postPlatformCheckWebhook,
  postPlatformToggleBot,
  savePlatformStoreSettings,
  submitPlatformRegisterRequest,
  type PlatformMyBusinessDTO,
  type PlatformStoreSettingsDTO,
} from "../services/platformApi";

function platformStatusLabel(status: string): string {
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

function webhookUrlLine(b: PlatformMyBusinessDTO): string {
  const u = b.webhookUrl;
  if (u != null && u.trim() !== "") return u.trim();
  return "URL вебхука не задан или недоступен";
}

function botRunBadge(b: PlatformMyBusinessDTO): { label: string; className: string } {
  if (b.isBlocked) {
    return {
      label: "⛔ Заблокирован",
      className:
        "rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400",
    };
  }
  if (!b.isActive) {
    return {
      label: "🔴 Отключён",
      className:
        "rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400",
    };
  }
  return {
    label: "🟢 Активен",
    className:
      "rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400",
  };
}

function subscriptionBadge(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "trialing") {
    return {
      label: "Trial",
      className:
        "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300",
    };
  }
  if (s === "active") {
    return {
      label: "Active",
      className:
        "rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2.5 py-0.5 text-xs font-medium text-[#4ADE80]",
    };
  }
  if (s === "inactive") {
    return {
      label: "Inactive",
      className:
        "rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400",
    };
  }
  if (s === "subscription_expired" || s === "expired") {
    return {
      label: "Expired",
      className:
        "rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400",
    };
  }
  if (s === "past_due") {
    return {
      label: "Past due",
      className:
        "rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300",
    };
  }
  if (s === "canceled") {
    return {
      label: "Canceled",
      className:
        "rounded-full border border-slate-600/40 bg-slate-600/15 px-2.5 py-0.5 text-xs font-medium text-slate-400",
    };
  }
  return {
    label: platformStatusLabel(status),
    className:
      "rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-300",
  };
}

const LS_ONBOARDING_COMPLETED = "onboardingCompleted";

function readOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_ONBOARDING_COMPLETED) === "true";
}

function webhookBadge(ws: PlatformMyBusinessDTO["webhookStatus"]): {
  label: string;
  className: string;
} {
  if (ws === "OK") {
    return {
      label: "✔ работает",
      className:
        "rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400",
    };
  }
  return {
    label: "❌ ошибка",
    className:
      "rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400",
  };
}

/** Панель клиента Mini App: маршрут `/merchant` (витрины по-прежнему `/?shop=ID`). */
export default function PlatformPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<PlatformMyBusinessDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [phone, setPhone] = useState("");
  const [finikApiKey, setFinikApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  /** Ряд активных действий по businessId для UX загрузки. */
  const [pendingByBusiness, setPendingByBusiness] = useState<
    Partial<Record<number, "toggle" | "webhook">>
  >({});

  const [settingsBusinessId, setSettingsBusinessId] = useState<number | null>(
    null,
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [settingsOkMsg, setSettingsOkMsg] = useState<string | null>(null);
  const [settingsSnap, setSettingsSnap] = useState<PlatformStoreSettingsDTO | null>(
    null,
  );
  const [settingsName, setSettingsName] = useState("");
  const [settingsFinik, setSettingsFinik] = useState("");
  const [finikTouched, setFinikTouched] = useState(false);
  const [settingsNewToken, setSettingsNewToken] = useState("");
  /** Сервер: только ADMIN_IDS видит админку (пробуем лёгкий GET заявок). */
  const [platformAdminAccess, setPlatformAdminAccess] = useState<
    "unknown" | "yes" | "no"
  >("unknown");

  const [onboardingDone, setOnboardingDone] = useState(readOnboardingCompleted);
  type OnboardingStep = 1 | 2 | 3 | "success";
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1);
  const onboardingZeroStoresRef = useRef(false);
  const prevZeroStores = useRef(false);

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
    setInfoBanner(null);
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

  const tgUserId = getTelegramWebApp()?.initDataUnsafe?.user?.id;
  const merchantTelegramId =
    typeof tgUserId === "number" &&
    Number.isFinite(tgUserId) &&
    tgUserId > 0
      ? tgUserId
      : NaN;

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void load();
  }, [load]);

  useEffect(() => {
    onboardingZeroStoresRef.current =
      !onboardingDone && !loading && !error && businesses.length === 0;
  }, [onboardingDone, loading, error, businesses.length]);

  const onboardingBaseOk = !onboardingDone && !loading && !error;
  useEffect(() => {
    const zero = onboardingBaseOk && businesses.length === 0;
    if (zero && !prevZeroStores.current) setOnboardingStep(1);
    prevZeroStores.current = zero;
  }, [onboardingBaseOk, businesses.length]);

  useEffect(() => {
    if (!Number.isFinite(merchantTelegramId)) {
      setPlatformAdminAccess("no");
      return;
    }
    let cancelled = false;
    setPlatformAdminAccess("unknown");
    void (async () => {
      try {
        await fetchPlatformAdminRequests(merchantTelegramId);
        if (!cancelled) setPlatformAdminAccess("yes");
      } catch {
        if (!cancelled) setPlatformAdminAccess("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantTelegramId]);

  useEffect(() => {
    if (settingsBusinessId == null) {
      setSettingsSnap(null);
      setSettingsErr(null);
      setSettingsOkMsg(null);
      setSettingsName("");
      setSettingsFinik("");
      setFinikTouched(false);
      setSettingsNewToken("");
      return;
    }
    if (!Number.isFinite(merchantTelegramId)) {
      setSettingsErr("Нет данных пользователя Telegram.");
      setSettingsLoading(false);
      return;
    }
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsErr(null);
    setSettingsOkMsg(null);
    void (async () => {
      try {
        const s = await fetchPlatformStoreSettings({
          telegramId: merchantTelegramId,
          businessId: settingsBusinessId,
        });
        if (cancelled) return;
        setSettingsSnap(s);
        setSettingsName(s.name);
        setSettingsFinik("");
        setFinikTouched(false);
        setSettingsNewToken("");
      } catch (e) {
        if (!cancelled) {
          setSettingsErr(
            e instanceof Error ? e.message : "Не удалось загрузить настройки",
          );
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsBusinessId, merchantTelegramId]);

  const setPending = (
    businessId: number,
    kind: "toggle" | "webhook",
    busy: boolean,
  ) => {
    setPendingByBusiness((prev) => {
      const next = { ...prev };
      if (busy) next[businessId] = kind;
      else delete next[businessId];
      return next;
    });
  };

  const handleToggleBot = async (b: PlatformMyBusinessDTO) => {
    if (!Number.isFinite(merchantTelegramId)) {
      setError("Нет данных пользователя Telegram.");
      return;
    }
    const action = b.isActive ? "disable" : "enable";
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "toggle", true);
    try {
      const r = await postPlatformToggleBot({
        telegramId: merchantTelegramId,
        businessId: b.id,
        action,
      });
      setBusinesses((prev) =>
        prev.map((row) =>
          row.id === b.id ? { ...row, isActive: r.isActive } : row,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить бота");
    } finally {
      setPending(b.id, "toggle", false);
    }
  };

  const handleCheckWebhook = async (b: PlatformMyBusinessDTO) => {
    if (!Number.isFinite(merchantTelegramId)) {
      setError("Нет данных пользователя Telegram.");
      return;
    }
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "webhook", true);
    try {
      const r = await postPlatformCheckWebhook({
        telegramId: merchantTelegramId,
        businessId: b.id,
      });
      const msgTail =
        r.lastErrorMessage && r.lastErrorMessage.trim() !== ""
          ? ` — ${r.lastErrorMessage}`
          : "";
      setInfoBanner(`${b.name}: ${r.status === "OK" ? "OK" : "ERROR"}${msgTail}`);
      setBusinesses((prev) =>
        prev.map((row) =>
          row.id === b.id ? { ...row, webhookStatus: r.status } : row,
        ),
      );
    } catch (e) {
      setInfoBanner(null);
      setError(e instanceof Error ? e.message : "Не удалось проверить webhook");
    } finally {
      setPending(b.id, "webhook", false);
    }
  };

  const openModal = () => {
    setSubmitError(null);
    setSuccessFlash(false);
    setModalOpen(true);
  };

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_ONBOARDING_COMPLETED, "true");
    }
    setOnboardingDone(true);
    setOnboardingStep(1);
  }, []);

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
        finikApiKey: finikApiKey.trim(),
        telegramId: uid,
      });
      setStoreName("");
      setBotToken("");
      setPhone("");
      setFinikApiKey("");
      setModalOpen(false);
      if (onboardingZeroStoresRef.current) {
        setOnboardingStep("success");
        setSuccessFlash(false);
      } else {
        setSuccessFlash(true);
        window.setTimeout(() => setSuccessFlash(false), 5000);
        void load();
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSubmitting(false);
    }
  };

  const closeSettingsModal = () => {
    setSettingsBusinessId(null);
  };

  const handleSaveSettings = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (
      !Number.isFinite(merchantTelegramId) ||
      settingsBusinessId == null ||
      settingsSnap == null
    ) {
      setSettingsErr("Сначала дождитесь загрузки настроек.");
      return;
    }
    const trimmedName = settingsName.trim();
    const nameChanged = trimmedName !== settingsSnap.name.trim();
    const newTok = settingsNewToken.replace(/\s/g, "").trim();

    const payload: {
      telegramId: number;
      businessId: number;
      storeName?: string;
      finikApiKey?: string;
      newBotToken?: string;
    } = {
      telegramId: merchantTelegramId,
      businessId: settingsBusinessId,
    };
    if (nameChanged) payload.storeName = trimmedName;
    if (finikTouched) payload.finikApiKey = settingsFinik.trim();
    if (newTok !== "") payload.newBotToken = newTok;

    if (
      payload.storeName === undefined &&
      payload.finikApiKey === undefined &&
      payload.newBotToken === undefined
    ) {
      setSettingsErr("Нет изменений для сохранения.");
      return;
    }

    setSettingsSaving(true);
    setSettingsErr(null);
    setSettingsOkMsg(null);
    try {
      const out = await savePlatformStoreSettings(payload);
      setSettingsSnap({
        businessId: settingsBusinessId,
        name: out.name,
        finikConfigured: out.finikConfigured,
        pendingBotTokenChange: out.pendingBotTokenChange,
      });
      setSettingsName(out.name);
      setSettingsFinik("");
      setFinikTouched(false);
      setSettingsNewToken("");
      setSettingsOkMsg(
        out.botTokenChangeRequestId != null
          ? "Заявка на смену токена отправлена администратору на подтверждение."
          : "Сохранено.",
      );
      setBusinesses((prev) =>
        prev.map((row) =>
          row.id === settingsBusinessId ? { ...row, name: out.name } : row,
        ),
      );
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSettingsSaving(false);
    }
  };

  const showBottomCreateBar =
    !loading && (businesses.length > 0 || error != null);

  const showOnboardingLayer =
    onboardingBaseOk &&
    (businesses.length === 0 || onboardingStep === "success");

  return (
    <div className="min-h-full bg-gradient-to-b from-[#0B1220] to-[#0F172A] text-slate-100">
      <div
        className={`mx-auto flex max-w-lg flex-col gap-4 px-4 py-6 ${showBottomCreateBar ? "pb-28" : "pb-10"}`}
      >
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
            🚀 Личный кабинет
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Управляйте своими магазинами
          </p>
        </motion.header>

        {platformAdminAccess === "yes" ? (
          <div
            className="rounded-2xl border border-violet-500/20 bg-violet-950/25 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl"
            role="region"
            aria-label="Панель администратора платформы"
          >
            <p className="text-sm text-violet-100/95">
              Заявки на регистрацию, все магазины, подписки, отключение ботов —
              только для администратора платформы.
            </p>
            <button
              type="button"
              onClick={() => navigate("/platform-admin")}
              className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-violet-950/40 transition hover:bg-violet-500 active:bg-violet-700"
            >
              🛠 Админ панель платформы
            </button>
          </div>
        ) : null}

        {successFlash ? (
          <p
            className="rounded-2xl border border-[#22C55E]/25 bg-[#22C55E]/10 px-4 py-3 text-center text-sm text-[#86EFAC] shadow-inner backdrop-blur-md"
            role="status"
          >
            ⏳ Заявка отправлена. Ожидайте подтверждения администратора
          </p>
        ) : null}

        {loading ? (
          <motion.p
            className="text-sm text-slate-500"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            Загрузка…
          </motion.p>
        ) : (
          <>
            {error ? (
              <div
                className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-md"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {infoBanner ? (
              <p
                className="rounded-2xl border border-[#22C55E]/20 bg-white/[0.04] px-4 py-3 text-sm text-[#BBF7D0] backdrop-blur-md"
                role="status"
              >
                {infoBanner}
              </p>
            ) : null}
            {!error && businesses.length === 0 ? (
              <motion.div
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center shadow-xl shadow-black/30 backdrop-blur-xl"
                role="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-lg font-semibold text-white">
                  🚀 У вас пока нет магазинов
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Создайте заявку — после одобрения магазин появится здесь.
                </p>
                <button
                  type="button"
                  onClick={openModal}
                  className="mt-6 w-full rounded-2xl bg-[#22C55E] px-4 py-3.5 text-center text-sm font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                >
                  ➕ Создать магазин
                </button>
              </motion.div>
            ) : null}
            {businesses.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {businesses.map((b, index) => {
                  const toggleBusy = pendingByBusiness[b.id] === "toggle";
                  const webhookBusy = pendingByBusiness[b.id] === "webhook";
                  const runBadge = botRunBadge(b);
                  const subBadge = subscriptionBadge(b.status);
                  const whBadge = webhookBadge(b.webhookStatus);
                  return (
                    <motion.li
                      key={b.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/40 backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-300 hover:border-white/15 hover:bg-white/[0.06] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl text-slate-200 transition group-hover:border-[#22C55E]/25 group-hover:bg-[#22C55E]/5"
                          aria-hidden
                        >
                          🏪
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-bold tracking-tight text-white">
                            {b.name}
                          </h2>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                            id {b.id}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={runBadge.className}>
                              {runBadge.label}
                            </span>
                            <span className={subBadge.className}>
                              {subBadge.label}
                            </span>
                            <span className={whBadge.className}>
                              {whBadge.label}
                            </span>
                          </div>
                          <p className="mt-2 break-all font-mono text-[11px] leading-snug text-slate-500">
                            {webhookUrlLine(b)}
                          </p>
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/?shop=${encodeURIComponent(String(b.id))}`,
                                )
                              }
                              className="flex-1 rounded-2xl bg-[#22C55E] px-4 py-3 text-center text-sm font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/20 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                            >
                              Открыть магазин
                            </button>
                            <button
                              type="button"
                              disabled={
                                settingsBusinessId === b.id &&
                                (settingsLoading || settingsSaving)
                              }
                              onClick={() => {
                                setSettingsErr(null);
                                setSettingsOkMsg(null);
                                setSettingsBusinessId(b.id);
                              }}
                              className="rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-slate-100 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-45 sm:min-w-[8.5rem]"
                            >
                              {settingsBusinessId === b.id &&
                              (settingsLoading || settingsSaving)
                                ? "…"
                                : "Настройки"}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {b.isActive ? (
                              <button
                                type="button"
                                disabled={toggleBusy}
                                onClick={() => void handleToggleBot(b)}
                                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/15 disabled:opacity-45"
                              >
                                {toggleBusy ? "…" : "Выключить"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={toggleBusy || b.isBlocked}
                                title={
                                  b.isBlocked
                                    ? "⛔ Магазин заблокирован администратором"
                                    : undefined
                                }
                                onClick={() => void handleToggleBot(b)}
                                className="rounded-xl border border-[#22C55E]/35 bg-[#22C55E]/10 px-3 py-2 text-xs font-semibold text-[#BBF7D0] transition hover:bg-[#22C55E]/15 disabled:opacity-45"
                              >
                                {toggleBusy ? "…" : "Включить"}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={webhookBusy}
                              onClick={() => void handleCheckWebhook(b)}
                              className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-45"
                            >
                              {webhookBusy ? "Проверка…" : "Проверить webhook"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {showBottomCreateBar ? (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0B1220]/85 p-4 backdrop-blur-xl sm:p-6">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={openModal}
              className="w-full rounded-2xl bg-[#22C55E] px-4 py-3.5 text-center text-sm font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/20 transition hover:bg-[#4ADE80] active:scale-[0.99]"
            >
              ➕ Создать магазин
            </button>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {showOnboardingLayer ? (
          <motion.div
            key="merchant-onboarding"
            className="fixed inset-0 z-[48] flex items-end justify-center bg-black/75 p-4 backdrop-blur-md sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Знакомство с кабинетом"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <motion.div
              className="mb-2 w-full max-w-lg rounded-3xl border border-white/10 bg-[#0B1220]/92 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:mb-0 sm:p-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="wait">
                {onboardingStep === 1 ? (
                  <motion.div
                    key="ob1"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white">
                        🚀 Добро пожаловать
                      </h2>
                      <p className="mt-3 text-base leading-relaxed text-slate-300">
                        Создайте свой Telegram-магазин за 1 минуту
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnboardingStep(2)}
                      className="w-full rounded-2xl bg-[#22C55E] px-4 py-4 text-center text-base font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                    >
                      👉 Начать
                    </button>
                  </motion.div>
                ) : null}
                {onboardingStep === 2 ? (
                  <motion.div
                    key="ob2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-5"
                  >
                    <h2 className="text-xl font-bold text-white">
                      Как подключить бота
                    </h2>
                    <ol className="list-decimal space-y-3 pl-5 text-base leading-relaxed text-slate-300">
                      <li>
                        Создайте бота в{" "}
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#4ADE80] underline decoration-[#22C55E]/50 underline-offset-2 hover:text-[#86EFAC]"
                        >
                          @BotFather
                        </a>
                      </li>
                      <li>Скопируйте token</li>
                      <li>Вставьте его сюда</li>
                    </ol>
                    <button
                      type="button"
                      onClick={() => setOnboardingStep(3)}
                      className="w-full rounded-2xl bg-[#22C55E] px-4 py-4 text-center text-base font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                    >
                      👉 Понятно
                    </button>
                  </motion.div>
                ) : null}
                {onboardingStep === 3 ? (
                  <motion.div
                    key="ob3"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-5"
                  >
                    <h2 className="text-xl font-bold text-white">
                      Создайте свой первый магазин
                    </h2>
                    <p className="text-sm text-slate-400">
                      Нажмите ниже — откроется форма заявки. После проверки
                      администратором магазин появится в списке.
                    </p>
                    <button
                      type="button"
                      onClick={openModal}
                      className="w-full rounded-2xl bg-[#22C55E] px-4 py-4 text-center text-base font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                    >
                      ➕ Создать магазин
                    </button>
                  </motion.div>
                ) : null}
                {onboardingStep === "success" ? (
                  <motion.div
                    key="ob4"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        ✅ Магазин создан
                      </h2>
                      <p className="mt-3 text-base leading-relaxed text-slate-300">
                        👉 Откройте его или настройте
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {businesses[0] != null ? (
                        <button
                          type="button"
                          onClick={() => {
                            markOnboardingComplete();
                            navigate(
                              `/?shop=${encodeURIComponent(String(businesses[0].id))}`,
                            );
                          }}
                          className="w-full rounded-2xl bg-[#22C55E] px-4 py-4 text-center text-base font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                        >
                          Открыть магазин
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          markOnboardingComplete();
                          void load();
                        }}
                        className={
                          businesses[0] != null
                            ? "w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-4 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
                            : "w-full rounded-2xl bg-[#22C55E] px-4 py-4 text-center text-base font-semibold text-[#052e16] shadow-lg shadow-[#22C55E]/25 transition hover:bg-[#4ADE80] active:scale-[0.99]"
                        }
                      >
                        Готово
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
              <div>
                <label
                  htmlFor="platform-finik"
                  className="mb-1 block text-sm text-slate-400"
                >
                  API ключ Finik (онлайн ККМ)
                </label>
                <input
                  id="platform-finik"
                  type="password"
                  autoComplete="off"
                  required
                  value={finikApiKey}
                  onChange={(e) => setFinikApiKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2"
                />
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

      {settingsBusinessId != null ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeSettingsModal();
          }}
        >
          <div
            role="dialog"
            aria-labelledby="platform-settings-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="platform-settings-title"
                className="text-lg font-semibold text-white"
              >
                Настройки магазина
              </h2>
              <button
                type="button"
                className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={closeSettingsModal}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {settingsLoading ? (
              <p className="text-sm text-slate-400">Загрузка…</p>
            ) : settingsErr != null && settingsSnap == null ? (
              <p className="text-sm text-red-300" role="alert">
                {settingsErr}
              </p>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => void handleSaveSettings(e)}
              >
                {settingsSnap?.pendingBotTokenChange ? (
                  <p
                    className="rounded-lg border border-amber-900/50 bg-amber-950/35 px-3 py-2 text-sm text-amber-100"
                    role="status"
                  >
                    ⏳ Ожидается подтверждение администратором смены токена бота.
                  </p>
                ) : null}

                <div>
                  <label
                    htmlFor="platform-settings-name"
                    className="mb-1 block text-sm text-slate-400"
                  >
                    Название магазина
                  </label>
                  <input
                    id="platform-settings-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="organization"
                    disabled={settingsSnap == null}
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="platform-settings-token"
                    className="mb-1 block text-sm text-slate-400"
                  >
                    Новый токен бота
                  </label>
                  <input
                    id="platform-settings-token"
                    type="password"
                    autoComplete="off"
                    disabled={settingsSnap == null}
                    value={settingsNewToken}
                    onChange={(e) => setSettingsNewToken(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2 disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Смена токена требует подтверждения администратором. Текущий
                    токен не отображается.
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="platform-settings-finik"
                      className="block text-sm text-slate-400"
                    >
                      Finik API Key
                    </label>
                    {settingsSnap?.finikConfigured ? (
                      <span className="text-xs text-emerald-400/90">
                        ключ задан
                      </span>
                    ) : null}
                  </div>
                  <input
                    id="platform-settings-finik"
                    type="password"
                    autoComplete="off"
                    disabled={settingsSnap == null}
                    value={settingsFinik}
                    onChange={(e) => {
                      setFinikTouched(true);
                      setSettingsFinik(e.target.value);
                    }}
                    placeholder="Введите ключ или сбросьте ниже"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none ring-emerald-500/50 focus:border-emerald-600 focus:ring-2 disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Сохраняется сразу (без подтверждения). Ключ не показывается
                    повторно.
                  </p>
                  <button
                    type="button"
                    disabled={settingsSnap == null}
                    onClick={() => {
                      setFinikTouched(true);
                      setSettingsFinik("");
                    }}
                    className="mt-2 text-xs font-medium text-amber-300/90 underline decoration-amber-700/80 hover:text-amber-200 disabled:opacity-45"
                  >
                    Сбросить ключ Finik
                  </button>
                </div>

                {settingsErr ? (
                  <p className="text-sm text-red-300" role="alert">
                    {settingsErr}
                  </p>
                ) : null}
                {settingsOkMsg ? (
                  <p
                    className="text-sm text-emerald-200/90"
                    role="status"
                  >
                    {settingsOkMsg}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    settingsSnap == null || settingsSaving || settingsLoading
                  }
                  className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {settingsSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
