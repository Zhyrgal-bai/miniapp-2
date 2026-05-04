import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { resolveMerchantTelegramUserId } from "../utils/telegramUserId";
import { ArchaHeader } from "../components/archa/ArchaHeader";
import { archa } from "../components/archa/archaUi";
import { fetchPlatformAdminRequests } from "../services/platformAdminApi";
import {
  fetchPlatformMyBusinesses,
  fetchPlatformStoreSettings,
  postPlatformCheckWebhook,
  postPlatformToggleBot,
  postPlatformUpdateFinik,
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
        "rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400",
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

  const [openCreate, setOpenCreate] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [phone, setPhone] = useState("");
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
  const [finikDraft, setFinikDraft] = useState("");
  const [finikSaving, setFinikSaving] = useState(false);
  const [finikMsg, setFinikMsg] = useState<string | null>(null);
  const [finikErr, setFinikErr] = useState<string | null>(null);
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

  const [merchantTelegramId, setMerchantTelegramId] = useState<number>(NaN);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfoBanner(null);
    try {
      let telegramId = NaN;
      for (let attempt = 0; attempt < 36; attempt++) {
        telegramId = resolveMerchantTelegramUserId(getTelegramWebApp());
        console.log("[PlatformPage] telegramId", telegramId, attempt);
        if (Number.isFinite(telegramId) && telegramId > 0) break;
        await new Promise((r) => setTimeout(r, 110));
      }

      if (!Number.isFinite(telegramId) || telegramId <= 0) {
        setMerchantTelegramId(NaN);
        setError("Откройте приложение из Telegram Mini App.");
        setBusinesses([]);
        return;
      }

      setMerchantTelegramId(telegramId);
      const rows = await fetchPlatformMyBusinesses({ telegramId });
      setBusinesses(rows);
    } catch (e) {
      setMerchantTelegramId(NaN);
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void loadBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- явная загрузка при входе (/merchant), как load() в ТЗ
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
    if (!Number.isFinite(merchantTelegramId) || merchantTelegramId <= 0) {
      setPlatformAdminAccess("unknown");
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
      setFinikDraft("");
      setFinikSaving(false);
      setFinikMsg(null);
      setFinikErr(null);
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
        setFinikDraft("");
        setFinikMsg(null);
        setFinikErr(null);
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

  const openCreateForm = () => {
    setSubmitError(null);
    setSuccessFlash(false);
    setOpenCreate(true);
  };

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_ONBOARDING_COMPLETED, "true");
    }
    setOnboardingDone(true);
    setOnboardingStep(1);
  }, []);

  const closeCreateForm = () => {
    setOpenCreate(false);
    setSubmitError(null);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const uid =
      Number.isFinite(merchantTelegramId) && merchantTelegramId > 0
        ? merchantTelegramId
        : resolveMerchantTelegramUserId(getTelegramWebApp());

    if (!Number.isFinite(uid) || uid <= 0) {
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
      setOpenCreate(false);
      if (onboardingZeroStoresRef.current) {
        setOnboardingStep("success");
        setSuccessFlash(false);
      } else {
        setSuccessFlash(true);
        window.setTimeout(() => setSuccessFlash(false), 5000);
        void loadBusinesses();
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

  const handleSaveFinik = async () => {
    if (!Number.isFinite(merchantTelegramId) || settingsBusinessId == null) {
      setFinikErr("Нет данных пользователя Telegram.");
      return;
    }
    setFinikSaving(true);
    setFinikErr(null);
    setFinikMsg(null);
    try {
      const out = await postPlatformUpdateFinik({
        telegramId: merchantTelegramId,
        businessId: settingsBusinessId,
        finikApiKey: finikDraft.trim(),
      });
      if (settingsSnap != null) {
        setSettingsSnap({
          ...settingsSnap,
          finikConfigured: out.finikConfigured,
        });
      }
      setFinikDraft("");
      setFinikMsg(
        out.finikConfigured
          ? "Finik сохранён. Ключ не отображается повторно."
          : "Finik отключён.",
      );
    } catch (e) {
      setFinikErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setFinikSaving(false);
    }
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
      newBotToken?: string;
    } = {
      telegramId: merchantTelegramId,
      businessId: settingsBusinessId,
    };
    if (nameChanged) payload.storeName = trimmedName;
    if (newTok !== "") payload.newBotToken = newTok;

    if (payload.storeName === undefined && payload.newBotToken === undefined) {
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

  const showOnboardingLayer =
    onboardingBaseOk &&
    (businesses.length === 0 || onboardingStep === "success");

  /** Нижний «Создать» — всегда после загрузки, кроме полноэкранного онбординга (чтобы не дублировать с оверлеем). */
  const showBottomCreateBar = !loading && !showOnboardingLayer;

  return (
    <>
      <div className={`${archa.pageRoot} min-h-screen pb-20`}>
        <div
          className={`mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-7 sm:px-5 ${
            showBottomCreateBar ? "pb-32" : "pb-24"
          }`}
        >
        <ArchaHeader subtitle="Управляйте своими магазинами" />

        {platformAdminAccess === "yes" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className={`${archa.cardGlass} border-[#22C55E]/15 px-4 py-4`}
            role="region"
            aria-label="Панель администратора платформы"
          >
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Заявки на регистрацию, все магазины, подписки, отключение ботов —
              только для администратора платформы.
            </p>
            <button
              type="button"
              onClick={() => navigate("/platform-admin")}
              className={`${archa.btnPrimary} mt-3`}
            >
              Админ-панель платформы
            </button>
          </motion.div>
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
            className={`text-sm ${archa.textMuted}`}
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
                className="rounded-2xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200 backdrop-blur-md"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {infoBanner ? (
              <p
                className="rounded-2xl border border-[#22C55E]/20 bg-[#111827]/80 px-4 py-3 text-sm text-[#BBF7D0] backdrop-blur-md"
                role="status"
              >
                {infoBanner}
              </p>
            ) : null}
            {!error && businesses.length === 0 ? (
              <motion.div
                className={`${archa.cardGlass} px-6 py-12 text-center`}
                role="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-lg font-semibold text-[#E5E7EB]">
                  У вас пока нет магазинов
                </p>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  Заявка после одобрения появится в списке. Нажмите «Создать» ниже
                  или откройте форму снизу экрана.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className={`${archa.btnPrimary} mt-8`}
                >
                  ➕ Создать
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
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={`group ${archa.cardGlass} ${archa.cardGlassHover} p-4 sm:p-5`}
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0F14]/80 shadow-inner transition duration-300 group-hover:border-[#22C55E]/30"
                          aria-hidden
                        >
                          <img
                            src="/674440574_18101674030793392_828162833995675842_n.jpg"
                            alt=""
                            className="h-10 w-10 object-cover opacity-90"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-bold tracking-tight text-[#E5E7EB]">
                            {b.name}
                          </h2>
                          <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">
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
                          <p className="mt-2 break-all font-mono text-[11px] leading-snug text-[#9CA3AF]/90">
                            {webhookUrlLine(b)}
                          </p>
                          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/?shop=${encodeURIComponent(String(b.id))}`,
                                )
                              }
                              className={archa.btnPrimarySm}
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
                              className={`${archa.btnSecondary} sm:min-w-[8.5rem]`}
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
                                className={archa.btnDanger}
                              >
                                {toggleBusy ? "…" : "Отключить"}
                              </button>
                            ) : b.isBlocked ? (
                              <span className="inline-flex h-10 items-center text-sm font-semibold text-yellow-400">
                                ⛔ Заблокирован
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={toggleBusy}
                                title="Включить магазин"
                                onClick={() => void handleToggleBot(b)}
                                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#22C55E] px-4 text-sm font-semibold text-black transition hover:bg-[#16A34A] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]"
                              >
                                {toggleBusy ? "…" : "🟢 Включить"}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={webhookBusy}
                              onClick={() => void handleCheckWebhook(b)}
                              className={archa.btnGhost}
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
      </div>

      {showBottomCreateBar ? (
        <div className={`${archa.bottomDock} relative z-[49] p-4 sm:p-5`}>
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={openCreateForm}
              className={archa.btnPrimary}
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
            className="pointer-events-none fixed inset-0 z-[48] flex items-end justify-center bg-[#0B0F14]/88 p-4 backdrop-blur-md sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Знакомство с кабинетом"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <motion.div
              className="pointer-events-auto mb-2 w-full max-w-lg rounded-3xl border border-white/[0.07] bg-[#111827]/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl sm:mb-0 sm:p-8"
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
                      className={`${archa.btnPrimary} py-4 text-base`}
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
                      className={`${archa.btnPrimary} py-4 text-base`}
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
                      onClick={openCreateForm}
                      className={`${archa.btnPrimary} py-4 text-base`}
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
                          className={`${archa.btnPrimary} py-4 text-base`}
                        >
                          Открыть магазин
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          markOnboardingComplete();
                          void loadBusinesses();
                        }}
                        className={
                          businesses[0] != null
                            ? `${archa.btnSecondary} w-full py-4 text-base`
                            : `${archa.btnPrimary} py-4 text-base`
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

      <AnimatePresence>
        {openCreate ? (
          <motion.div
            key="platform-register-modal"
            className="fixed inset-0 z-50 flex min-h-0 max-h-[100dvh] flex-col overflow-hidden bg-[#0B0F14] [height:100dvh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-register-title"
            aria-describedby="platform-register-desc"
          >
            <motion.div
              className="flex min-h-0 flex-1 flex-col gap-[16px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="flex shrink-0 items-center gap-[12px] px-[16px] pt-[16px] pb-[8px]">
                <img
                  src="/674440574_18101674030793392_828162833995675842_n.jpg"
                  alt="ARCHA"
                  width={40}
                  height={40}
                  className="h-[40px] w-[40px] shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.06)] object-cover shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
                />
                <div className="flex min-w-[0] flex-1 flex-col gap-[8px]">
                  <p className="text-[18px] font-[700] leading-[1.25] text-[#E5E7EB]">
                    ARCHA
                  </p>
                  <p className="text-[14px] leading-[1.375] text-[#9CA3AF]">
                    Магазин в Telegram
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="shrink-0 rounded-[9999px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-[12px] py-[8px] text-[14px] font-[500] text-[#D1D5DB] transition active:bg-[rgba(255,255,255,0.12)]"
                  aria-label="Закрыть"
                >
                  Закрыть
                </button>
              </header>

              <form
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                onSubmit={handleSubmit}
              >
                <div
                  className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-[16px] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-[16px]">
                    <div className="flex flex-col gap-[16px] rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-[#111827] p-[16px] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                      <div className="flex flex-col gap-[8px] text-center">
                        <h2
                          id="platform-register-title"
                          className="text-[20px] font-[600] text-[#E5E7EB]"
                        >
                          Создание магазина
                        </h2>
                        <p
                          id="platform-register-desc"
                          className="text-[14px] leading-[1.625] text-[#9CA3AF]"
                        >
                          Заполните поля — заявка уйдёт на проверку
                        </p>
                      </div>

                      <div className="flex flex-col gap-[4px]">
                        <label
                          htmlFor="platform-store-name"
                          className="text-left text-[14px] text-[#9CA3AF]"
                        >
                          Название
                        </label>
                        <input
                          id="platform-store-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={160}
                          autoComplete="organization"
                          placeholder="Например: Archa Store"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          className="w-full rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#0F172A] px-[16px] py-[12px] text-[16px] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] outline-none placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 focus:ring-offset-[#111827] disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col gap-[4px]">
                        <label
                          htmlFor="platform-bot-token"
                          className="text-left text-[14px] text-[#9CA3AF]"
                        >
                          Токен бота
                        </label>
                        <input
                          id="platform-bot-token"
                          type="password"
                          autoComplete="off"
                          required
                          placeholder="От BotFather"
                          value={botToken}
                          onChange={(e) => setBotToken(e.target.value)}
                          className="w-full rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#0F172A] px-[16px] py-[12px] font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[16px] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] outline-none placeholder:font-[inherit] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 focus:ring-offset-[#111827] disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col gap-[4px]">
                        <label
                          htmlFor="platform-phone"
                          className="text-left text-[14px] text-[#9CA3AF]"
                        >
                          Телефон
                        </label>
                        <input
                          id="platform-phone"
                          type="tel"
                          required
                          inputMode="tel"
                          placeholder="+996…"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#0F172A] px-[16px] py-[12px] text-[16px] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] outline-none placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 focus:ring-offset-[#111827] disabled:opacity-50"
                        />
                        <p className="text-[12px] leading-[1.5] text-[#6B7280]">
                          +996 и 9 цифр или 0 и 9 цифр
                        </p>
                      </div>

                      {submitError ? (
                        <p
                          className="text-center text-[14px] leading-[1.625] text-[#fca5a5]"
                          role="alert"
                        >
                          {submitError}
                        </p>
                      ) : null}

                      <motion.button
                        type="submit"
                        disabled={submitting}
                        whileTap={submitting ? undefined : { scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 500, damping: 28 }}
                        className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-[#22C55E] text-[16px] font-[600] text-[#0B0F14] disabled:pointer-events-none disabled:opacity-[0.45]"
                      >
                        {submitting ? "Отправка…" : "Отправить заявку"}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsBusinessId != null ? (
          <motion.div
            key="platform-settings-modal"
            className={archa.modalBackdropElevated}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget) closeSettingsModal();
            }}
          >
            <motion.div
              role="dialog"
              aria-labelledby="platform-settings-title"
              className={archa.modalCard}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
            >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="platform-settings-title"
                className="text-lg font-semibold text-[#E5E7EB]"
              >
                Настройки магазина
              </h2>
              <button
                type="button"
                className="rounded-xl border border-white/[0.08] px-2.5 py-1.5 text-sm text-[#9CA3AF] transition hover:border-white/15 hover:bg-white/[0.06] hover:text-[#E5E7EB]"
                onClick={closeSettingsModal}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {settingsLoading ? (
              <p className={`text-sm ${archa.textMuted}`}>Загрузка…</p>
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
                    className="rounded-xl border border-amber-500/25 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-100"
                    role="status"
                  >
                    ⏳ Ожидается подтверждение администратором смены токена бота.
                  </p>
                ) : null}

                <div>
                  <label
                    htmlFor="platform-settings-name"
                    className={`mb-1 block text-sm ${archa.textMuted}`}
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
                    className={archa.input}
                  />
                </div>

                <div>
                  <label
                    htmlFor="platform-settings-token"
                    className={`mb-1 block text-sm ${archa.textMuted}`}
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
                    className={`${archa.input} font-mono`}
                  />
                  <p className={`mt-1 text-xs ${archa.textMuted}`}>
                    Смена токена требует подтверждения администратором. Текущий
                    токен не отображается.
                  </p>
                </div>

                <div className={`${archa.cardGlass} border-white/[0.05] p-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold tracking-tight text-white">
                      💳 Finik
                    </span>
                    {settingsSnap?.finikConfigured ? (
                      <span className="text-xs font-medium text-[#86EFAC]">
                        ✅ Finik подключён
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-300/95">
                        ⚠️ Не подключён
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs text-slate-400">
                    API Key:{" "}
                    <span className="text-slate-300">
                      {settingsSnap?.finikConfigured
                        ? "************"
                        : "—"}
                    </span>
                  </p>
                  <label
                    htmlFor="platform-settings-finik-draft"
                    className={`mb-1 mt-3 block text-xs font-medium ${archa.textMuted}`}
                  >
                    Новый API ключ Finik
                  </label>
                  <input
                    id="platform-settings-finik-draft"
                    type="password"
                    autoComplete="off"
                    disabled={settingsSnap == null || finikSaving}
                    value={finikDraft}
                    onChange={(e) => {
                      setFinikDraft(e.target.value);
                      setFinikErr(null);
                      setFinikMsg(null);
                    }}
                    placeholder="Вставьте ключ"
                    className={`${archa.input} font-mono`}
                  />
                  <p className={`mt-1.5 text-[11px] leading-relaxed ${archa.textMuted}`}>
                    Оставьте поле пустым и нажмите «Сохранить», чтобы отключить
                    Finik. Ключ на сервер не возвращается.
                  </p>
                  {finikErr ? (
                    <p className="mt-2 text-sm text-red-300" role="alert">
                      {finikErr}
                    </p>
                  ) : null}
                  {finikMsg ? (
                    <p className="mt-2 text-sm text-[#86EFAC]" role="status">
                      {finikMsg}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      settingsSnap == null || finikSaving || settingsLoading
                    }
                    onClick={() => void handleSaveFinik()}
                    className={`${archa.btnPrimary} mt-3`}
                  >
                    {finikSaving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>

                {settingsErr ? (
                  <p className="text-sm text-red-300" role="alert">
                    {settingsErr}
                  </p>
                ) : null}
                {settingsOkMsg ? (
                  <p
                    className="text-sm text-[#86EFAC]"
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
                  className={`${archa.btnPrimary} mt-1`}
                >
                  {settingsSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </form>
            )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
