import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  type PlatformMyBusinessDTO,
  type PlatformStoreSettingsDTO,
} from "../services/platformApi";
import { MERCHANT_REGISTER_SENT_KEY } from "./MerchantRegisterPage";
import "./MerchantPage.css";

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
      className: "mp-tag mp-tag--run-blocked",
    };
  }
  if (!b.isActive) {
    return {
      label: "🔴 Отключён",
      className: "mp-tag mp-tag--run-off",
    };
  }
  return {
    label: "🟢 Активен",
    className: "mp-tag mp-tag--run-ok",
  };
}

function subscriptionBadge(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "trialing") {
    return {
      label: "Trial",
      className: "mp-tag mp-tag--sub-trial",
    };
  }
  if (s === "active") {
    return {
      label: "Active",
      className: "mp-tag mp-tag--sub-active",
    };
  }
  if (s === "inactive") {
    return {
      label: "Inactive",
      className: "mp-tag mp-tag--sub-muted",
    };
  }
  if (s === "subscription_expired" || s === "expired") {
    return {
      label: "Expired",
      className: "mp-tag mp-tag--sub-muted",
    };
  }
  if (s === "past_due") {
    return {
      label: "Past due",
      className: "mp-tag mp-tag--sub-warn",
    };
  }
  if (s === "canceled") {
    return {
      label: "Canceled",
      className: "mp-tag mp-tag--sub-muted",
    };
  }
  return {
    label: platformStatusLabel(status),
    className: "mp-tag mp-tag--sub-muted",
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
      label: "✔ Webhook OK",
      className: "mp-tag mp-tag--hook-ok",
    };
  }
  return {
    label: "❌ Webhook",
    className: "mp-tag mp-tag--hook-bad",
  };
}

/** Панель клиента Mini App: маршрут `/merchant` (витрины по-прежнему `/?shop=ID`). */
export default function PlatformPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<PlatformMyBusinessDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

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
    try {
      sessionStorage.removeItem("miniapp-active-shop");
    } catch {
      /* ignore */
    }
    let flashTimer: ReturnType<typeof window.setTimeout> | undefined;
    try {
      if (
        sessionStorage.getItem(MERCHANT_REGISTER_SENT_KEY) === "1"
      ) {
        sessionStorage.removeItem(MERCHANT_REGISTER_SENT_KEY);
        setSuccessFlash(true);
        if (!readOnboardingCompleted()) {
          setOnboardingStep("success");
        }
        flashTimer = window.setTimeout(() => setSuccessFlash(false), 8000);
      }
    } catch {
      /* ignore */
    }
    void loadBusinesses();
    return () => {
      if (flashTimer != null) window.clearTimeout(flashTimer);
    };
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

  const goToMerchantRegister = useCallback(() => {
    try {
      getTelegramWebApp()?.expand?.();
    } catch {
      /* ignore */
    }
    try {
      (
        getTelegramWebApp() as
          | { HapticFeedback?: { impactOccurred?: (s: string) => void } }
          | undefined
      )?.HapticFeedback?.impactOccurred?.("light");
    } catch {
      /* ignore */
    }
    navigate("/merchant/register");
  }, [navigate]);

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_ONBOARDING_COMPLETED, "true");
    }
    setOnboardingDone(true);
    setOnboardingStep(1);
  }, []);

  /** Fallback: нижняя зелёная кнопка Telegram — открывает отдельный маршрут с формой. */
  const openCreateHandlerRef = useRef(goToMerchantRegister);
  openCreateHandlerRef.current = goToMerchantRegister;
  useEffect(() => {
    const tg = getTelegramWebApp();
    type Mb = {
      MainButton?: {
        setParams: (p: { text?: string }) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        onClick: (fn: () => void) => void;
        offClick: (fn: () => void) => void;
      };
    };
    const mb = (tg as Mb).MainButton;
    if (
      loading ||
      businesses.length > 0 ||
      tg == null ||
      mb == null ||
      typeof mb.onClick !== "function" ||
      typeof mb.offClick !== "function" ||
      typeof mb.show !== "function" ||
      typeof mb.hide !== "function"
    ) {
      if (tg != null && mb != null && typeof mb.hide === "function") {
        try {
          mb.hide();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const handler = () => openCreateHandlerRef.current();
    try {
      const tp = mb as {
        setParams?: (p: { text?: string }) => void;
        setText?: (t: string) => void;
      };
      if (typeof tp.setParams === "function") {
        tp.setParams({ text: "➕ Создать магазин" });
      } else if (typeof tp.setText === "function") {
        tp.setText("➕ Создать магазин");
      }
      if (typeof mb.enable === "function") mb.enable();
      mb.onClick(handler);
      mb.show();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        mb.offClick(handler);
        mb.hide();
      } catch {
        /* ignore */
      }
    };
  }, [loading, businesses.length]);

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
      <div className="mp-page">
        <div
          className={`mp-shell ${showBottomCreateBar ? "mp-shell--dock" : ""}`}
        >
          <ArchaHeader
            className="mp-top-header"
            subtitle="Управляйте своими магазинами"
          />

        {platformAdminAccess === "yes" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mp-panel mp-panel--admin px-4 py-4"
            role="region"
            aria-label="Панель администратора платформы"
          >
            <p className="mp-muted leading-relaxed">
              Заявки на регистрацию, все магазины, подписки, отключение ботов —
              только для администратора платформы.
            </p>
            <button
              type="button"
              onClick={() => navigate("/platform-admin")}
              className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-3"
            >
              Админ-панель платформы
            </button>
          </motion.div>
        ) : null}

        {successFlash ? (
          <p className="mp-flash mp-flash--ok" role="status">
            ⏳ Заявка отправлена. Ожидайте подтверждения администратора
          </p>
        ) : null}

        {loading ? (
          <motion.p
            className="mp-muted"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            Загрузка…
          </motion.p>
        ) : (
          <>
            {error ? (
              <div className="mp-flash mp-flash--err text-left" role="alert">
                {error}
              </div>
            ) : null}
            {infoBanner ? (
              <p className="mp-flash mp-flash--info text-left" role="status">
                {infoBanner}
              </p>
            ) : null}
            {!error && businesses.length === 0 ? (
              <motion.div
                className="mp-panel mp-panel--empty"
                role="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-lg font-semibold text-white">
                  У вас пока нет магазинов
                </p>
                <p className="mt-2 text-base leading-relaxed text-slate-400">
                  Заявка после одобрения появится в списке. Нажмите «Создать» ниже
                  или откройте форму снизу экрана.
                </p>
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    goToMerchantRegister();
                  }}
                  className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-8"
                >
                  ➕ Создать
                </button>
              </motion.div>
            ) : null}
            {businesses.length > 0 ? (
              <ul className="mp-store-list">
                {businesses.map((b, index) => {
                  const toggleBusy = pendingByBusiness[b.id] === "toggle";
                  const webhookBusy = pendingByBusiness[b.id] === "webhook";
                  const runBadge = botRunBadge(b);
                  const subBadge = subscriptionBadge(b.status);
                  const whBadge = webhookBadge(b.webhookStatus);
                  const subLocked = !b.subscriptionActive;
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
                      className="mp-panel mp-store group"
                    >
                      <div className="flex gap-3">
                        <div className="mp-store-avatar" aria-hidden>
                          <img
                            src="/674440574_18101674030793392_828162833995675842_n.jpg"
                            alt=""
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-bold tracking-tight text-white">
                            {b.name}
                          </h2>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                            id {b.id}
                          </p>
                          <div className="mp-tag-row">
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
                          <div className="mp-webhook-block">
                            <div className="mp-webhook-label">
                              Вебхук Telegram
                            </div>
                            <div className="mp-webhook-url">
                              {webhookUrlLine(b)}
                            </div>
                          </div>
                          {!b.isBlocked && subLocked ? (
                            <p className="mt-3 text-sm font-semibold text-amber-200/95">
                              Оплатите подписку — без действующего периода функции
                              магазина недоступны.
                            </p>
                          ) : null}
                          <div className="mp-store-actions-primary">
                            <button
                              type="button"
                              disabled={subLocked}
                              onClick={() =>
                                navigate(
                                  `/?shop=${encodeURIComponent(String(b.id))}`,
                                )
                              }
                              className="mp-btn mp-btn--primary mp-btn--sm min-w-0"
                              title={
                                subLocked
                                  ? "Оплатите подписку"
                                  : undefined
                              }
                            >
                              Открыть магазин
                            </button>
                            <button
                              type="button"
                              disabled={
                                subLocked ||
                                (settingsBusinessId === b.id &&
                                  (settingsLoading || settingsSaving))
                              }
                              onClick={(ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                setSettingsErr(null);
                                setSettingsOkMsg(null);
                                setSettingsBusinessId(b.id);
                              }}
                              className="mp-btn mp-btn--secondary mp-btn--sm min-w-0 sm:min-w-[8.5rem]"
                            >
                              {settingsBusinessId === b.id &&
                              (settingsLoading || settingsSaving)
                                ? "…"
                                : "Настройки"}
                            </button>
                          </div>
                          <div className="mp-store-actions-secondary">
                            {platformAdminAccess === "yes" &&
                            b.isActive &&
                            !b.isBlocked ? (
                              <button
                                type="button"
                                disabled={toggleBusy || subLocked}
                                onClick={() => void handleToggleBot(b)}
                                className="mp-btn mp-btn--danger mp-btn-wide-mobile"
                                title={
                                  subLocked
                                    ? "Оплатите подписку"
                                    : undefined
                                }
                              >
                                {toggleBusy ? "…" : "Отключить бота"}
                              </button>
                            ) : null}
                            {!b.isActive && b.isBlocked ? (
                              <span className="inline-flex min-h-[2.5rem] items-center text-sm font-semibold text-yellow-300">
                                ⛔ Заблокирован
                              </span>
                            ) : null}
                            {!b.isActive && !b.isBlocked ? (
                              <button
                                type="button"
                                disabled={toggleBusy || subLocked}
                                title={
                                  subLocked
                                    ? "Оплатите подписку"
                                    : "Включить магазин"
                                }
                                onClick={() => void handleToggleBot(b)}
                                className="mp-btn mp-btn-enable mp-btn-wide-mobile"
                              >
                                {toggleBusy ? "…" : "🟢 Включить"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={webhookBusy || subLocked}
                              title={
                                subLocked
                                  ? "Оплатите подписку"
                                  : undefined
                              }
                              onClick={() => void handleCheckWebhook(b)}
                              className="mp-btn mp-btn--ghost mp-btn-wide-mobile"
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
        <div className="mp-dock relative z-[49]">
          <div className="mp-dock-inner">
            <button
              type="button"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                goToMerchantRegister();
              }}
              className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
            >
              ➕ Создать магазин
            </button>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {showOnboardingLayer ? (
          <>
            <motion.div
              key="merchant-onboarding-backdrop"
              aria-hidden
              className="mp-onboard-backdrop fixed inset-0 z-[48]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              style={{ pointerEvents: "none" }}
            />
            <motion.div
              key="merchant-onboarding-sheet"
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[49] flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:bottom-auto sm:left-0 sm:right-0 sm:top-0 sm:items-center sm:pb-[max(16px,env(safe-area-inset-bottom))]"
              role="dialog"
              aria-modal="true"
              aria-label="Знакомство с кабинетом"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
            <motion.div
              className="mp-onboard-card pointer-events-auto w-full max-w-lg"
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
                      <p className="mp-onboard-muted mt-3 text-base leading-relaxed">
                        Создайте свой Telegram-магазин за 1 минуту
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnboardingStep(2)}
                      className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
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
                    <ol className="mp-onboard-muted list-decimal space-y-3 pl-5 text-base leading-relaxed">
                      <li>
                        Создайте бота в{" "}
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="mp-onboarding-link"
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
                      className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
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
                    <p className="mp-onboard-soft">
                      Нажмите ниже — откроется форма заявки. После проверки
                      администратором магазин появится в списке.
                    </p>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        goToMerchantRegister();
                      }}
                      className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
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
                      <p className="mp-onboard-muted mt-3 text-base leading-relaxed">
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
                          className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
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
                            ? "mp-btn mp-btn--secondary mp-btn--block mp-btn--lg"
                            : "mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
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
          </>
        ) : null}
      </AnimatePresence>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {settingsBusinessId != null ? (
                <motion.div
                  key="platform-settings-modal"
                  className="mp-settings-backdrop"
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
                    aria-modal="true"
                    aria-labelledby="platform-settings-title"
                    className="mp-settings-dialog-shell"
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ type: "spring", damping: 26, stiffness: 340 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                    }}
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
                className="rounded-xl border border-white/[0.08] px-2.5 py-1.5 text-sm text-[#9CA3AF] transition hover:border-white/15 hover:bg-white/[0.06] hover:text-[#E5E7EB]"
                onClick={closeSettingsModal}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {settingsLoading ? (
              <p className="mp-muted text-sm">Загрузка…</p>
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
                    className="mp-muted mb-1 block text-sm"
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
                    className="mp-muted mb-1 block text-sm"
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
                  <p className="mp-muted mt-1 text-xs">
                    Смена токена требует подтверждения администратором. Текущий
                    токен не отображается.
                  </p>
                </div>

                <div className="mp-settings-slab">
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
                    className="mp-muted mb-1 mt-3 block text-xs font-medium"
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
                  <p className="mp-muted mt-1.5 text-[11px] leading-relaxed">
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
                    className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-3"
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
                  className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-1"
                >
                  {settingsSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </form>
            )}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
