import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { resolveMerchantTelegramUserId } from "../utils/telegramUserId";
import { archa } from "../components/archa/archaUi";
import {
  PlatformQuickActions,
  PlatformShell,
  type PlatformMenuItem,
} from "../components/platform/PlatformShell";
import { PlatformStoreCard } from "../components/platform/PlatformStoreCard";
import {
  businessTypeLabel,
  formatDaysRemaining,
  formatRuDateShort,
  miniAppOpenUrl,
  subscriptionBadge,
} from "./platform/platformUi";
import {
  formatSaasPriceSom,
  SAAS_SUBSCRIPTION_PLANS,
  saasPricePerDayLabel,
} from "@repo-shared/saasSubscriptionPricing";
import {
  fetchPlatformAdminBusinesses,
  fetchPlatformAdminRequests,
  postPlatformAdminApprove,
  postPlatformAdminReject,
  postPlatformAdminDisable,
  postPlatformAdminEnable,
  postPlatformAdminExtend,
  postPlatformAdminPurgeBusiness,
  postPlatformAdminUnblock,
  type PlatformAdminBusinessDTO,
  type PlatformAdminRequestDTO,
} from "../services/platformAdminApi";
import {
  fetchPlatformMyBusinesses,
  fetchOperatorCapabilities,
  fetchPlatformStoreSettings,
  fetchRegistrationStatus,
  postOperatorLock,
  postOperatorReauth,
  postOperatorUnlock,
  postPlatformCheckWebhook,
  postPlatformSubscriptionPaymentCreate,
  postPlatformUpdateFinik,
  savePlatformStoreSettings,
  fetchStoreReadiness,
  postPlatformFeedback,
  type PlatformMyBusinessDTO,
  type PlatformStoreSettingsDTO,
  type StoreReadinessPayload,
} from "../services/platformApi";
import { trackPlatformFunnel } from "../services/platformFunnel";
import { formatAdminApiError } from "../utils/adminApiError";
import {
  MerchantSettingsRenderer,
  type SchemaObject as MerchantSchemaObject,
} from "../components/merchant/MerchantSettingsRenderer";
import { MERCHANT_REGISTER_SENT_KEY } from "./MerchantRegisterPage";
import "./MerchantPage.css";
import type { RegistrationStatusPayload } from "../services/platformApi";
import { ru } from "../i18n/ru";
import { useBodyScrollLock } from "../utils/bodyScrollLock";

function miniAppNavigatePath(b: Pick<PlatformMyBusinessDTO, "id" | "slug">): string {
  const s = typeof b.slug === "string" ? b.slug.trim() : "";
  if (s !== "") return `/s/${encodeURIComponent(s)}`;
  return `/?shop=${encodeURIComponent(String(b.id))}`;
}

function subscriptionDaysLeftNumber(iso: string | null): number | null {
  if (iso == null || iso.trim() === "") return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

function settingsPrimarySubscriptionEnd(snap: PlatformStoreSettingsDTO): {
  endIso: string | null;
  kind: "trial" | "paid" | null;
} {
  const status = snap.subscriptionStatus?.toLowerCase() ?? "";
  if (status === "trialing" && snap.trialEndsAt) {
    return { endIso: snap.trialEndsAt, kind: "trial" };
  }
  if (snap.subscriptionEndsAt) {
    return { endIso: snap.subscriptionEndsAt, kind: "paid" };
  }
  if (snap.trialEndsAt) {
    return { endIso: snap.trialEndsAt, kind: "trial" };
  }
  return { endIso: null, kind: null };
}

function adminBusinessToCard(row: PlatformAdminBusinessDTO): PlatformMyBusinessDTO {
  return {
    id: row.id,
    name: row.name,
    slug: null,
    status: row.status,
    isActive: row.isActive,
    isBlocked: row.isBlocked,
    subscriptionActive: row.subscriptionActive,
    subscriptionEndsAt: row.subscriptionEndsAt,
    trialEndsAt: row.trialEndsAt,
    webhookStatus: row.webhookStatus,
    webhookUrl: row.webhookUrl,
  };
}

const LS_ONBOARDING_COMPLETED = "onboardingCompleted";

function readOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_ONBOARDING_COMPLETED) === "true";
}

/** Панель клиента Mini App: маршрут `/merchant` (витрины: `/store/:slug` или legacy `/?shop=ID`). */
export default function PlatformPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<PlatformMyBusinessDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  const [successFlash, setSuccessFlash] = useState(false);
  /** Ряд активных действий по businessId для UX загрузки. */
  const [pendingByBusiness, setPendingByBusiness] = useState<
    Partial<
      Record<number, "toggle" | "webhook" | "delete" | "extend" | "unblock">
    >
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
  const [merchantConfigDraft, setMerchantConfigDraft] = useState<
    Record<string, unknown>
  >({});

  const [readiness, setReadiness] = useState<StoreReadinessPayload | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackOk, setFeedbackOk] = useState<string | null>(null);

  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatusPayload | null>(null);
  const [operatorRequests, setOperatorRequests] = useState<
    PlatformAdminRequestDTO[]
  >([]);
  const [operatorRequestsLoading, setOperatorRequestsLoading] = useState(false);
  const [operatorRequestBusyId, setOperatorRequestBusyId] = useState<number | null>(
    null,
  );
  const [rejectModalRequestId, setRejectModalRequestId] = useState<number | null>(
    null,
  );
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");

  const [onboardingDone, setOnboardingDone] = useState(readOnboardingCompleted);
  type OnboardingStep = 1 | 2 | 3 | "success";
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1);
  const prevZeroStores = useRef(false);

  const [merchantTelegramId, setMerchantTelegramId] = useState<number>(NaN);
  const [operatorIdentity, setOperatorIdentity] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [operatorSessionToken, setOperatorSessionToken] = useState<string | null>(
    null,
  );
  const [operatorUnlockOpen, setOperatorUnlockOpen] = useState(false);
  const [operatorPassword, setOperatorPassword] = useState("");
  const [operatorUnlockBusy, setOperatorUnlockBusy] = useState(false);
  const [operatorUnlockError, setOperatorUnlockError] = useState<string | null>(
    null,
  );
  const [payPlanBusy, setPayPlanBusy] = useState<30 | 90 | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const storesSectionRef = useRef<HTMLElement>(null);
  const helpSectionRef = useRef<HTMLElement>(null);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfoBanner(null);
    try {
      let telegramId = NaN;
      for (let attempt = 0; attempt < 50; attempt++) {
        const tg = getTelegramWebApp();
        const initSigned =
          typeof tg?.initData === "string" ? tg.initData.trim() : "";
        telegramId = resolveMerchantTelegramUserId(tg);
        if (
          initSigned.length > 20 &&
          Number.isFinite(telegramId) &&
          telegramId > 0
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 120));
      }

      const tgFinal = getTelegramWebApp();
      const signed =
        typeof tgFinal?.initData === "string" ? tgFinal.initData.trim() : "";

      if (signed === "") {
        setMerchantTelegramId(NaN);
        setOperatorIdentity(false);
        setIsPlatformAdmin(false);
        setOperatorSessionToken(null);
        setError(
          "Нет данных Mini App из Telegram (initData пустой). Откройте приложение кнопкой Web App из бота, не по прямой ссылке браузера.",
        );
        setBusinesses([]);
        return;
      }

      if (!Number.isFinite(telegramId) || telegramId <= 0) {
        setMerchantTelegramId(NaN);
        setOperatorIdentity(false);
        setIsPlatformAdmin(false);
        setOperatorSessionToken(null);
        setError("Откройте приложение из Telegram Mini App.");
        setBusinesses([]);
        return;
      }

      setMerchantTelegramId(telegramId);
      const caps = await fetchOperatorCapabilities().catch(() => ({
        isOperatorIdentity: false,
        canShowOperatorEntry: false,
      }));
      setOperatorIdentity(Boolean(caps.canShowOperatorEntry));
      setIsPlatformAdmin(false);
      setOperatorSessionToken(null);
      const rows = await fetchPlatformMyBusinesses({ telegramId });
      setBusinesses(rows);
      if (rows.length === 0) {
        const regStatus = await fetchRegistrationStatus().catch(() => null);
        setRegistrationStatus(regStatus);
      } else {
        setRegistrationStatus(null);
      }
    } catch (e) {
      setMerchantTelegramId(NaN);
      setOperatorIdentity(false);
      setIsPlatformAdmin(false);
      setOperatorSessionToken(null);
      setError(formatAdminApiError(e));
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOperatorBusinesses = useCallback(
    async (telegramId: number, token: string) => {
      const [adminRows, requestRows] = await Promise.all([
        fetchPlatformAdminBusinesses({
          telegramId,
          operatorSessionToken: token,
        }),
        fetchPlatformAdminRequests(telegramId, { operatorSessionToken: token }),
      ]);
      setBusinesses(
        adminRows
          .filter((r) => r.id > 0)
          .map(adminBusinessToCard),
      );
      setOperatorRequests(requestRows);
      setIsPlatformAdmin(true);
    },
    [],
  );

  const loadOperatorRequestsOnly = useCallback(
    async (telegramId: number, token: string) => {
      setOperatorRequestsLoading(true);
      try {
        const rows = await fetchPlatformAdminRequests(telegramId, {
          operatorSessionToken: token,
        });
        setOperatorRequests(rows);
      } catch (e) {
        setError(formatAdminApiError(e));
      } finally {
        setOperatorRequestsLoading(false);
      }
    },
    [],
  );

  const ensureOperatorReauth = useCallback(async (): Promise<boolean> => {
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
      return false;
    }
    const pass = window.prompt("Подтвердите пароль оператора");
    if (pass == null || pass.trim() === "") return false;
    try {
      await postOperatorReauth(token, pass.trim());
      return true;
    } catch (e) {
      setError(formatAdminApiError(e));
      return false;
    }
  }, [operatorSessionToken]);

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
    trackPlatformFunnel("platform_view");
    return () => {
      if (flashTimer != null) window.clearTimeout(flashTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- явная загрузка при входе (/merchant), как load() в ТЗ
  }, []);

  useEffect(() => {
    if (onboardingStep === 1) trackPlatformFunnel("onboarding_step_1");
    if (onboardingStep === 2) trackPlatformFunnel("onboarding_step_2");
    if (onboardingStep === 3) trackPlatformFunnel("onboarding_step_3");
  }, [onboardingStep]);

  useEffect(() => {
    const first = businesses[0];
    if (first == null || first.id <= 0) {
      setReadiness(null);
      return;
    }
    let cancelled = false;
    void fetchStoreReadiness(first.id)
      .then((r) => {
        if (!cancelled) setReadiness(r);
      })
      .catch(() => {
        if (!cancelled) setReadiness(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businesses]);

  const onboardingBaseOk = !onboardingDone && !loading && !error;
  useEffect(() => {
    const zero = onboardingBaseOk && businesses.length === 0;
    if (zero && !prevZeroStores.current) setOnboardingStep(1);
    prevZeroStores.current = zero;
  }, [onboardingBaseOk, businesses.length]);

  useBodyScrollLock(operatorUnlockOpen || rejectModalRequestId != null);

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
        setMerchantConfigDraft(s.merchantConfig ?? {});
        setFinikDraft("");
        setFinikMsg(null);
        setFinikErr(null);
        setSettingsNewToken("");
      } catch (e) {
        if (!cancelled) {
          setSettingsErr(formatAdminApiError(e));
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
    kind: "toggle" | "webhook" | "delete" | "extend" | "unblock",
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
    if (!isPlatformAdmin) {
      setError("Включение и отключение бота доступно только оператору платформы.");
      return;
    }
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
      return;
    }
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "toggle", true);
    try {
      if (b.isActive) {
        await postPlatformAdminDisable({
          telegramId: merchantTelegramId,
          businessId: b.id,
          operatorSessionToken: token,
        });
      } else {
        await postPlatformAdminEnable({
          telegramId: merchantTelegramId,
          businessId: b.id,
          operatorSessionToken: token,
        });
      }
      await loadOperatorBusinesses(merchantTelegramId, token);
      setInfoBanner(`${b.name}: статус бота обновлён`);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPending(b.id, "toggle", false);
    }
  };

  const handleCheckWebhook = async (b: PlatformMyBusinessDTO) => {
    if (!Number.isFinite(merchantTelegramId)) {
      setError("Нет данных пользователя Telegram.");
      return;
    }
    if (!isPlatformAdmin) {
      setError("Проверку webhook может запускать только оператор платформы.");
      return;
    }
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
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
      setError(formatAdminApiError(e));
    } finally {
      setPending(b.id, "webhook", false);
    }
  };

  const handleCopyMiniAppUrl = async (b: PlatformMyBusinessDTO) => {
    const url = miniAppOpenUrl(b);
    if (url === "") return;
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setInfoBanner(`${b.name}: ссылка Mini App скопирована`);
    } catch {
      setInfoBanner(null);
      setError("Не удалось скопировать — выделите ссылку вручную");
    }
  };

  const handleDeleteShop = async (b: PlatformMyBusinessDTO) => {
    if (!Number.isFinite(merchantTelegramId)) {
      setError("Нет данных пользователя Telegram.");
      return;
    }
    if (!isPlatformAdmin) {
      setError("Удаление магазина доступно только оператору платформы.");
      return;
    }
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
      return;
    }
    const confirmed = window.confirm(
      `Удалить магазин «${b.name}» (id ${b.id}) безвозвратно? Все товары, заказы и настройки будут удалены.`,
    );
    if (!confirmed) return;
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "delete", true);
    try {
      await postPlatformAdminPurgeBusiness({
        telegramId: merchantTelegramId,
        businessId: b.id,
        operatorSessionToken: token,
      });
      if (settingsBusinessId === b.id) {
        setSettingsBusinessId(null);
      }
      setInfoBanner(`Магазин «${b.name}» удалён`);
      await loadOperatorBusinesses(merchantTelegramId, token);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPending(b.id, "delete", false);
    }
  };

  const handleExtendSubscription = async (
    b: PlatformMyBusinessDTO,
    days: 30 | 90,
  ) => {
    if (!Number.isFinite(merchantTelegramId)) {
      setError("Нет данных пользователя Telegram.");
      return;
    }
    if (!isPlatformAdmin) return;
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
      return;
    }
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "extend", true);
    try {
      const out = await postPlatformAdminExtend({
        telegramId: merchantTelegramId,
        businessId: b.id,
        days,
        operatorSessionToken: token,
      });
      setInfoBanner(
        `${b.name}: подписка продлена до ${formatRuDateShort(out.subscriptionEndsAt) ?? "—"}`,
      );
      await loadOperatorBusinesses(merchantTelegramId, token);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPending(b.id, "extend", false);
    }
  };

  const handleUnblockShop = async (b: PlatformMyBusinessDTO) => {
    if (!Number.isFinite(merchantTelegramId)) return;
    if (!isPlatformAdmin) return;
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) {
      setError("Сессия оператора не активна.");
      return;
    }
    setError(null);
    setInfoBanner(null);
    setPending(b.id, "unblock", true);
    try {
      await postPlatformAdminUnblock({
        telegramId: merchantTelegramId,
        businessId: b.id,
        operatorSessionToken: token,
      });
      setInfoBanner(`${b.name}: блокировка снята`);
      await loadOperatorBusinesses(merchantTelegramId, token);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPending(b.id, "unblock", false);
    }
  };

  const handleClientSubscriptionPay = async (plan: 30 | 90) => {
    if (!Number.isFinite(merchantTelegramId) || settingsBusinessId == null) {
      setFinikErr("Нет данных для оплаты.");
      return;
    }
    if (isPlatformAdmin) return;
    setPayPlanBusy(plan);
    setFinikErr(null);
    setError(null);
    try {
      const out = await postPlatformSubscriptionPaymentCreate({
        telegramId: merchantTelegramId,
        businessId: settingsBusinessId,
        plan,
      });
      if ("finikConfigured" in out && out.finikConfigured === false) {
        setFinikErr(out.message);
        return;
      }
      if ("paymentUrl" in out) {
        const tg = getTelegramWebApp() as
          | { openLink?: (url: string) => void }
          | undefined;
        tg?.openLink?.(out.paymentUrl);
        setFinikMsg("Откроется страница оплаты Finik");
      }
    } catch (e) {
      setFinikErr(formatAdminApiError(e));
    } finally {
      setPayPlanBusy(null);
    }
  };

  const handleOperatorUnlock = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!Number.isFinite(merchantTelegramId) || merchantTelegramId <= 0) {
      setOperatorUnlockError("Нет данных Telegram пользователя.");
      return;
    }
    const password = operatorPassword.trim();
    if (password === "") {
      setOperatorUnlockError("Введите пароль оператора.");
      return;
    }
    setOperatorUnlockBusy(true);
    setOperatorUnlockError(null);
    try {
      const out = await postOperatorUnlock(password);
      setOperatorSessionToken(out.token);
      await loadOperatorBusinesses(merchantTelegramId, out.token);
      setOperatorPassword("");
      setOperatorUnlockOpen(false);
      setInfoBanner(ru.platform.operatorActivated);
    } catch (e) {
      setOperatorUnlockError(formatAdminApiError(e));
    } finally {
      setOperatorUnlockBusy(false);
    }
  };

  const handleOperatorLock = async () => {
    const token = operatorSessionToken?.trim();
    try {
      if (token) {
        await postOperatorLock(token);
      }
    } catch {
      /* ignore */
    } finally {
      setIsPlatformAdmin(false);
      setOperatorSessionToken(null);
      setOperatorUnlockOpen(false);
      setOperatorPassword("");
      setOperatorUnlockError(null);
      await loadBusinesses();
      setInfoBanner(ru.platform.operatorClosed);
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
    trackPlatformFunnel("register_start");
  }, [navigate]);

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_ONBOARDING_COMPLETED, "true");
    }
    setOnboardingDone(true);
    setOnboardingStep(1);
    trackPlatformFunnel("onboarding_complete");
  }, []);

  const openStorefront = useCallback(
    (b: PlatformMyBusinessDTO) => {
      trackPlatformFunnel("store_open", { businessId: b.id });
      navigate(miniAppNavigatePath(b));
    },
    [navigate],
  );

  const submitFeedback = useCallback(async () => {
    const text = feedbackText.trim();
    if (text.length < 4) return;
    setFeedbackBusy(true);
    setFeedbackOk(null);
    try {
      await postPlatformFeedback({
        kind: "ux",
        message: text,
        businessId: businesses[0]?.id,
        page: "platform",
      });
      setFeedbackText("");
      setFeedbackOk("Спасибо! Мы получили ваше сообщение.");
    } catch {
      setFeedbackOk("Не удалось отправить. Попробуйте позже.");
    } finally {
      setFeedbackBusy(false);
    }
  }, [feedbackText, businesses]);

  const handleApproveRequest = async (requestId: number) => {
    if (!Number.isFinite(merchantTelegramId)) return;
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) return;
    setOperatorRequestBusyId(requestId);
    setError(null);
    try {
      await postPlatformAdminApprove({
        telegramId: merchantTelegramId,
        requestId,
        operatorSessionToken: token,
      });
      await loadOperatorBusinesses(merchantTelegramId, token);
      setInfoBanner(ru.platform.requestApproved);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setOperatorRequestBusyId(null);
    }
  };

  const handleRejectRequest = async () => {
    if (rejectModalRequestId == null || !Number.isFinite(merchantTelegramId)) return;
    if (!(await ensureOperatorReauth())) return;
    const token = operatorSessionToken?.trim();
    if (!token) return;
    const reason = rejectReasonDraft.trim();
    if (reason.length < 3) {
      setError("Укажите причину отклонения (минимум 3 символа)");
      return;
    }
    setOperatorRequestBusyId(rejectModalRequestId);
    setError(null);
    try {
      await postPlatformAdminReject({
        telegramId: merchantTelegramId,
        requestId: rejectModalRequestId,
        rejectReason: reason,
        operatorSessionToken: token,
      });
      await loadOperatorRequestsOnly(merchantTelegramId, token);
      setRejectModalRequestId(null);
      setRejectReasonDraft("");
      setInfoBanner(ru.platform.requestRejected);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setOperatorRequestBusyId(null);
    }
  };

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
      registrationStatus?.status === "pending" ||
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
  }, [loading, businesses.length, registrationStatus?.status]);

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
      setFinikErr(formatAdminApiError(e));
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
      merchantConfig?: Record<string, unknown>;
    } = {
      telegramId: merchantTelegramId,
      businessId: settingsBusinessId,
    };
    if (nameChanged) payload.storeName = trimmedName;
    if (newTok !== "") payload.newBotToken = newTok;
    if (
      isPlatformAdmin &&
      Object.keys(settingsSnap.merchantSettingsSchema ?? {}).length > 0
    ) {
      payload.merchantConfig = merchantConfigDraft;
    }

    if (
      payload.storeName === undefined &&
      payload.newBotToken === undefined &&
      payload.merchantConfig === undefined
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
        businessType: settingsSnap.businessType,
        merchantConfig:
          isPlatformAdmin &&
          Object.keys(settingsSnap.merchantSettingsSchema ?? {}).length > 0
            ? merchantConfigDraft
            : settingsSnap.merchantConfig,
        merchantSettingsSchema: settingsSnap.merchantSettingsSchema,
        subscriptionStatus: settingsSnap.subscriptionStatus,
        subscriptionEndsAt: settingsSnap.subscriptionEndsAt,
        trialEndsAt: settingsSnap.trialEndsAt,
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
      setSettingsErr(formatAdminApiError(e));
    } finally {
      setSettingsSaving(false);
    }
  };

  const showOnboardingLayer =
    onboardingBaseOk &&
    (businesses.length === 0 || onboardingStep === "success");

  const regPending = registrationStatus?.status === "pending";

  /** Нижний «Создать» — после загрузки, если нет магазина и нет pending-заявки. */
  const showBottomCreateBar =
    !loading &&
    !showOnboardingLayer &&
    !isPlatformAdmin &&
    businesses.length === 0 &&
    !regPending;

  const primaryBusiness = businesses[0] ?? null;
  const primarySubLocked = primaryBusiness != null && !primaryBusiness.subscriptionActive;

  const scrollToStores = useCallback(() => {
    storesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToHelp = useCallback(() => {
    helpSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const closeMiniApp = useCallback(() => {
    try {
      (getTelegramWebApp() as { close?: () => void } | undefined)?.close?.();
    } catch {
      /* ignore */
    }
  }, []);

  const openPrimarySettings = useCallback(() => {
    if (primaryBusiness == null) return;
    setSettingsErr(null);
    setSettingsOkMsg(null);
    setSettingsBusinessId(primaryBusiness.id);
  }, [primaryBusiness]);

  const platformMenuItems = useMemo((): PlatformMenuItem[] => {
    const items: PlatformMenuItem[] = [
      { id: "stores", label: "Мои магазины", icon: "🏪", onClick: scrollToStores },
      {
        id: "create",
        label: "Создать магазин",
        icon: "➕",
        onClick: goToMerchantRegister,
      },
      {
        id: "analytics",
        label: "Аналитика",
        icon: "📊",
        onClick: () => {
          if (primaryBusiness != null && !primarySubLocked) {
            openStorefront(primaryBusiness);
          } else {
            scrollToStores();
          }
        },
      },
      { id: "support", label: "Поддержка", icon: "💬", onClick: scrollToHelp },
      {
        id: "docs",
        label: "Документация",
        icon: "📖",
        onClick: () => {
          const url = "https://t.me/archa_kg";
          try {
            getTelegramWebApp()?.openTelegramLink?.(url);
          } catch {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        },
      },
      {
        id: "subscription",
        label: "Подписка",
        icon: "⭐",
        onClick: () => {
          if (primaryBusiness != null) openPrimarySettings();
          else scrollToStores();
        },
      },
      {
        id: "settings",
        label: "Настройки",
        icon: "⚙️",
        onClick: () => {
          if (primaryBusiness != null) openPrimarySettings();
          else goToMerchantRegister();
        },
      },
      { id: "close", label: "Закрыть", icon: "✕", onClick: closeMiniApp, danger: true },
    ];
    return items;
  }, [
    scrollToStores,
    goToMerchantRegister,
    primaryBusiness,
    primarySubLocked,
    openStorefront,
    scrollToHelp,
    openPrimarySettings,
    closeMiniApp,
  ]);

  const quickActions = useMemo(() => {
    if (loading || businesses.length === 0) return [];
    const b = primaryBusiness;
    if (b == null) return [];
    const locked = !b.subscriptionActive;
    return [
      {
        id: "open",
        label: "Магазин",
        icon: "🛍",
        accent: true,
        disabled: locked,
        onClick: () => openStorefront(b),
      },
      {
        id: "settings",
        label: "Настройки",
        icon: "⚙️",
        onClick: () => {
          setSettingsErr(null);
          setSettingsOkMsg(null);
          setSettingsBusinessId(b.id);
        },
      },
      {
        id: "share",
        label: "Поделиться",
        icon: "🔗",
        onClick: () => void handleCopyMiniAppUrl(b),
      },
      {
        id: "create",
        label: "Новый",
        icon: "➕",
        onClick: goToMerchantRegister,
      },
      {
        id: "orders",
        label: "Заказы",
        icon: "📦",
        disabled: locked,
        onClick: () => {
          if (!locked) openStorefront(b);
        },
      },
      {
        id: "products",
        label: "Товары",
        icon: "🏷",
        disabled: locked,
        onClick: () => {
          if (!locked) openStorefront(b);
        },
      },
    ];
  }, [
    loading,
    businesses.length,
    primaryBusiness,
    openStorefront,
    goToMerchantRegister,
    handleCopyMiniAppUrl,
  ]);

  const readinessPct =
    readiness != null && readiness.maxScore > 0
      ? Math.round((readiness.score / readiness.maxScore) * 100)
      : 0;

  return (
    <>
      <div className="mp-page mp-page--v2">
        <div
          className={`mp-shell mp-shell--v2 ${showBottomCreateBar ? "mp-shell--dock" : ""}`}
        >
          <PlatformShell
            subtitle={
              isPlatformAdmin
                ? "Панель оператора платформы"
                : "Управляйте магазинами в одном месте"
            }
            roleLabel={isPlatformAdmin ? "Оператор" : "Продавец"}
            isAdmin={isPlatformAdmin}
            menuOpen={menuOpen}
            onMenuOpenChange={setMenuOpen}
            menuItems={platformMenuItems}
            operatorAction={
              operatorIdentity && !isPlatformAdmin ? (
                <button
                  type="button"
                  className="mp-v2-header-link"
                  onClick={() => {
                    setOperatorUnlockError(null);
                    setOperatorPassword("");
                    setOperatorUnlockOpen(true);
                  }}
                >
                  {ru.platform.operatorMode}
                </button>
              ) : isPlatformAdmin ? (
                <button
                  type="button"
                  className="mp-v2-header-link"
                  onClick={() => void handleOperatorLock()}
                >
                  {ru.platform.operatorModeClose}
                </button>
              ) : null
            }
          >
            {!loading && businesses.length > 0 && !isPlatformAdmin ? (
              <PlatformQuickActions actions={quickActions} />
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
                className={`mp-v2-card mp-v2-empty ${
                  registrationStatus?.status === "pending"
                    ? "mp-v2-empty--pending"
                    : registrationStatus?.status === "rejected"
                      ? "mp-v2-empty--rejected"
                      : ""
                }`}
                role="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {registrationStatus?.status === "pending" ? (
                  <>
                    <div className="mp-v2-empty-icon" aria-hidden>
                      ⏳
                    </div>
                    <h3>Заявка на рассмотрении</h3>
                    <p>
                      «{registrationStatus.storeName ?? "Магазин"}» — оператор проверит
                      данные. Уведомление придёт в Telegram.
                    </p>
                  </>
                ) : registrationStatus?.status === "rejected" ? (
                  <>
                    <div className="mp-v2-empty-icon" aria-hidden>
                      ✕
                    </div>
                    <h3>Заявка отклонена</h3>
                    <p>
                      {registrationStatus.storeName
                        ? `«${registrationStatus.storeName}»`
                        : "Последняя заявка"}
                      {registrationStatus.rejectReason
                        ? `: ${registrationStatus.rejectReason}`
                        : "."}
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
                      Подать новую заявку
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mp-v2-empty-icon" aria-hidden>
                      🏪
                    </div>
                    <h3>Запустите свой магазин</h3>
                    <p>
                      Создайте витрину в Mini App — заявка уйдёт на проверку, затем
                      откроется полный доступ.
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
                      Создать магазин
                    </button>
                  </>
                )}
              </motion.div>
            ) : null}
            {isPlatformAdmin ? (
              <div className="mp-panel mb-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {ru.platform.requestsInbox} ({operatorRequests.length})
                  </p>
                  <button
                    type="button"
                    className="mp-btn mp-btn--ghost mp-btn--sm"
                    disabled={operatorRequestsLoading}
                    onClick={() => {
                      const token = operatorSessionToken?.trim();
                      if (!token || !Number.isFinite(merchantTelegramId)) return;
                      void loadOperatorRequestsOnly(merchantTelegramId, token);
                    }}
                  >
                    {operatorRequestsLoading ? "…" : ru.common.refresh}
                  </button>
                </div>
                {operatorRequests.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">{ru.platform.noPendingRequests}</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {operatorRequests.map((req) => (
                      <li
                        key={req.id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{req.storeName}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              #{req.id} · {businessTypeLabel(req.businessType)} ·{" "}
                              {formatRuDateShort(req.createdAt) ?? req.createdAt}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="mp-btn mp-btn--primary mp-btn--sm"
                              disabled={operatorRequestBusyId === req.id}
                              onClick={() => void handleApproveRequest(req.id)}
                            >
                              {ru.common.approve}
                            </button>
                            <button
                              type="button"
                              className="mp-btn mp-btn--secondary mp-btn--sm"
                              disabled={operatorRequestBusyId === req.id}
                              onClick={() => {
                                setRejectReasonDraft("");
                                setRejectModalRequestId(req.id);
                              }}
                            >
                              {ru.common.reject}
                            </button>
                          </div>
                        </div>
                        <dl className="mt-3 grid gap-1 text-xs text-slate-400">
                          <div>
                            <span className="text-slate-500">{ru.platform.telegramId}: </span>
                            {req.telegramId}
                          </div>
                          {req.ownerUsername ? (
                            <div>
                              <span className="text-slate-500">Username: </span>@
                              {req.ownerUsername}
                            </div>
                          ) : null}
                          <div>
                            <span className="text-slate-500">Телефон: </span>
                            {req.phone}
                          </div>
                          {req.botUsername ? (
                            <div>
                              <span className="text-slate-500">{ru.platform.botLabel}: </span>@
                              {req.botUsername}
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {businesses.length > 0 ? (
              <>
            {readiness ? (
              <section className="mp-v2-section" aria-label="Готовность">
                <h2 className="mp-v2-section-title">Готовность</h2>
                <div className="mp-v2-card mp-v2-readiness" role="status">
                  <p className="mp-v2-readiness-score">
                    {readiness.score}
                    <span> / {readiness.maxScore}</span>
                  </p>
                  <div className="mp-v2-readiness-bar-wrap">
                    <div
                      className="mp-v2-readiness-bar"
                      style={{ width: `${readinessPct}%` }}
                    />
                  </div>
                  {readiness.recommendations.length > 0 ? (
                    <ul className="mt-3 list-none space-y-1.5 p-0 text-sm text-slate-400">
                      {readiness.recommendations.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-400">
                      Магазин готов к продажам.
                    </p>
                  )}
                </div>
              </section>
            ) : null}
              <section
                ref={storesSectionRef}
                className="mp-v2-section"
                aria-label="Магазины"
              >
                <h2 className="mp-v2-section-title">
                  {isPlatformAdmin ? "Магазины платформы" : "Мои магазины"}
                </h2>
                <ul className="mp-v2-store-list">
                {businesses.map((b, index) => (
                  <PlatformStoreCard
                    key={b.id}
                    business={b}
                    index={index}
                    isPlatformAdmin={isPlatformAdmin}
                    settingsBusinessId={settingsBusinessId}
                    settingsLoading={settingsLoading}
                    settingsSaving={settingsSaving}
                    toggleBusy={pendingByBusiness[b.id] === "toggle"}
                    webhookBusy={pendingByBusiness[b.id] === "webhook"}
                    deleteBusy={pendingByBusiness[b.id] === "delete"}
                    extendBusy={pendingByBusiness[b.id] === "extend"}
                    unblockBusy={pendingByBusiness[b.id] === "unblock"}
                    onOpenStore={openStorefront}
                    onOpenSettings={(row) => {
                      setSettingsErr(null);
                      setSettingsOkMsg(null);
                      setSettingsBusinessId(row.id);
                    }}
                    onCopyMiniApp={(row) => void handleCopyMiniAppUrl(row)}
                    onToggleBot={(row) => void handleToggleBot(row)}
                    onCheckWebhook={(row) => void handleCheckWebhook(row)}
                    onDeleteShop={(row) => void handleDeleteShop(row)}
                    onExtendSubscription={(row, days) =>
                      void handleExtendSubscription(row, days)
                    }
                    onUnblockShop={(row) => void handleUnblockShop(row)}
                  />
                ))}
              </ul>
              </section>
            <section
              ref={helpSectionRef}
              className="mp-v2-section"
              aria-label="Поддержка"
            >
              <h2 className="mp-v2-section-title">Помощь</h2>
              <div className="mp-v2-card mp-v2-help-card">
                <p className="text-sm font-semibold text-white">Обратная связь</p>
                <p>
                  Нашли баг или непонятный экран? Напишите — это помогает улучшить
                  продукт.
                </p>
                <textarea
                  className="mp-input w-full min-h-[72px] rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white"
                  rows={3}
                  value={feedbackText}
                  disabled={feedbackBusy}
                  placeholder="Опишите проблему или идею…"
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
                <button
                  type="button"
                  className="mp-btn mp-btn--secondary mt-2"
                  disabled={feedbackBusy || feedbackText.trim().length < 4}
                  onClick={() => void submitFeedback()}
                >
                  {feedbackBusy ? "Отправка…" : "Отправить"}
                </button>
                {feedbackOk ? (
                  <p className="mt-2 text-sm text-slate-300" role="status">
                    {feedbackOk}
                  </p>
                ) : null}
              </div>
            </section>
              </>
            ) : null}
          </>
        )}
          </PlatformShell>
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

      {rejectModalRequestId != null ? (
        <div className="mp-settings-backdrop">
          <div
            className="mp-settings-dialog-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-request-title"
          >
            <h2 id="reject-request-title" className="text-lg font-semibold text-white">
              {ru.platform.rejectTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{ru.platform.rejectHint}</p>
            <textarea
              className={`${archa.input} mt-4 min-h-[96px]`}
              value={rejectReasonDraft}
              onChange={(e) => setRejectReasonDraft(e.target.value)}
              placeholder={ru.platform.rejectPlaceholder}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="mp-btn mp-btn--secondary mp-btn--block"
                onClick={() => {
                  setRejectModalRequestId(null);
                  setRejectReasonDraft("");
                }}
              >
                {ru.common.cancel}
              </button>
              <button
                type="button"
                className="mp-btn mp-btn--primary mp-btn--block"
                disabled={operatorRequestBusyId != null}
                onClick={() => void handleRejectRequest()}
              >
                {ru.common.reject}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {operatorUnlockOpen ? (
        <div className="mp-settings-backdrop">
          <div
            className="mp-settings-dialog-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-unlock-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="operator-unlock-title"
                className="text-lg font-semibold text-white"
              >
                {ru.platform.operatorUnlock}
              </h2>
              <button
                type="button"
                className="rounded-xl border border-white/[0.08] px-2.5 py-1.5 text-sm text-[#9CA3AF] transition hover:border-white/15 hover:bg-white/[0.06] hover:text-[#E5E7EB]"
                onClick={() => {
                  setOperatorUnlockOpen(false);
                  setOperatorPassword("");
                  setOperatorUnlockError(null);
                }}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => void handleOperatorUnlock(e)}>
              <div>
                <label className="mp-muted mb-1 block text-sm" htmlFor="operator-password">
                  Пароль оператора
                </label>
                <input
                  id="operator-password"
                  type="password"
                  autoComplete="current-password"
                  value={operatorPassword}
                  onChange={(e) => setOperatorPassword(e.target.value)}
                  className={archa.input}
                  disabled={operatorUnlockBusy}
                />
              </div>
              {operatorUnlockError ? (
                <p className="text-sm text-red-300" role="alert">
                  {operatorUnlockError}
                </p>
              ) : null}
              <button
                type="submit"
                className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
                disabled={operatorUnlockBusy}
              >
                {operatorUnlockBusy ? "Проверка…" : ru.platform.operatorUnlockSubmit}
              </button>
            </form>
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
                            openStorefront(businesses[0]!)
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
            <div className="mp-settings-header">
              <div>
                <h2
                  id="platform-settings-title"
                  className="mp-settings-header__title"
                >
                  Настройки магазина
                </h2>
                {settingsSnap != null ? (
                  <p className="mp-settings-header__sub">{settingsSnap.name}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={archa.btnIcon}
                onClick={closeSettingsModal}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {settingsLoading ? (
              <div className="mp-settings-scroll">
                <p className="mp-muted text-sm">Загрузка…</p>
              </div>
            ) : settingsErr != null && settingsSnap == null ? (
              <div className="mp-settings-scroll">
                <p className="text-sm text-red-300" role="alert">
                  {settingsErr}
                </p>
              </div>
            ) : (
              <form
                className="mp-settings-form"
                onSubmit={(e) => void handleSaveSettings(e)}
              >
                <div className="mp-settings-scroll">
                {settingsSnap?.pendingBotTokenChange ? (
                  <p className="mp-settings-alert mp-settings-alert--amber" role="status">
                    Ожидается подтверждение администратором смены токена бота.
                  </p>
                ) : null}

                {settingsSnap != null ? (() => {
                  const subBadge = subscriptionBadge(
                    settingsSnap.subscriptionStatus,
                  );
                  const primaryEnd = settingsPrimarySubscriptionEnd(settingsSnap);
                  const daysLeft = subscriptionDaysLeftNumber(primaryEnd.endIso);
                  const endLabel = formatRuDateShort(primaryEnd.endIso);
                  const progressPct =
                    daysLeft != null && daysLeft >= 0
                      ? Math.min(100, Math.max(4, (daysLeft / 30) * 100))
                      : 0;
                  const progressClass =
                    daysLeft != null && daysLeft < 0
                      ? "mp-settings-hero__progress-fill--danger"
                      : daysLeft != null && daysLeft <= 7
                        ? "mp-settings-hero__progress-fill--warn"
                        : "";

                  return (
                    <div className="mp-settings-section mp-settings-section--accent">
                      <div className="mp-settings-section__head">
                        <span className="mp-settings-section__title">
                          Подписка
                        </span>
                        <span className={subBadge.className}>
                          {subBadge.label}
                        </span>
                      </div>
                      {endLabel != null ? (
                        <>
                          <div className="mp-settings-hero__metrics">
                            <div>
                              {daysLeft != null && daysLeft >= 0 ? (
                                <>
                                  <div className="mp-settings-hero__days">
                                    {daysLeft}
                                  </div>
                                  <div className="mp-settings-hero__days-label">
                                    {daysLeft === 1
                                      ? "день остался"
                                      : daysLeft >= 2 && daysLeft <= 4
                                        ? "дня осталось"
                                        : "дней осталось"}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="mp-settings-hero__days">—</div>
                                  <div className="mp-settings-hero__days-label">
                                    {formatDaysRemaining(primaryEnd.endIso) ??
                                      "срок не указан"}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="mp-settings-hero__until">
                              <span className="mp-settings-hero__until-kind">
                                {primaryEnd.kind === "trial"
                                  ? "Пробный период"
                                  : "Оплаченный период"}
                              </span>
                              до {endLabel}
                            </div>
                          </div>
                          {daysLeft != null && daysLeft >= 0 ? (
                            <div
                              className="mp-settings-hero__progress"
                              role="progressbar"
                              aria-valuenow={daysLeft}
                              aria-valuemin={0}
                              aria-valuemax={30}
                              aria-label="Оставшийся срок подписки"
                            >
                              <div
                                className={[
                                  "mp-settings-hero__progress-fill",
                                  progressClass,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="mp-settings-section__desc">
                          Срок подписки не указан.
                        </p>
                      )}
                    </div>
                  );
                })() : null}

                <div className="mp-settings-section">
                  <div className="mp-settings-section__head">
                    <span className="mp-settings-section__title">Магазин</span>
                  </div>
                  <p className="mp-settings-section__desc">
                    Название видят покупатели в витрине и заказах.
                  </p>
                  <div className="mp-settings-field">
                    <label
                      htmlFor="platform-settings-name"
                      className="mp-settings-field__label"
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

                  {settingsSnap != null &&
                  isPlatformAdmin &&
                  Object.keys(settingsSnap.merchantSettingsSchema ?? {}).length >
                    0 ? (
                    <div className="mp-settings-field">
                      <label className="mp-settings-field__label">
                        Настройки ({settingsSnap.businessType})
                      </label>
                      <MerchantSettingsRenderer
                        schema={
                          settingsSnap.merchantSettingsSchema as unknown as MerchantSchemaObject
                        }
                        value={merchantConfigDraft}
                        onChange={setMerchantConfigDraft}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mp-settings-section">
                  <div className="mp-settings-section__head">
                    <span className="mp-settings-section__title">
                      Telegram-бот
                    </span>
                  </div>
                  <p className="mp-settings-section__desc">
                    Смена токена требует подтверждения администратором. Текущий
                    токен не отображается.
                  </p>
                  <div className="mp-settings-field">
                    <label
                      htmlFor="platform-settings-token"
                      className="mp-settings-field__label"
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
                      placeholder="Вставьте новый токен"
                      className={`${archa.input} font-mono`}
                    />
                  </div>
                </div>

                <div className="mp-settings-section mp-settings-section--accent">
                  <div className="mp-settings-section__head">
                    <span className="mp-settings-section__title">Finik</span>
                    {settingsSnap?.finikConfigured ? (
                      <span className="mp-settings-status-pill mp-settings-status-pill--ok">
                        Подключён
                      </span>
                    ) : (
                      <span className="mp-settings-status-pill mp-settings-status-pill--warn">
                        Не подключён
                      </span>
                    )}
                  </div>
                  <p className="mp-settings-section__desc">
                    Платежи в витрине и продление подписки. Ключ на сервер не
                    возвращается после сохранения.
                  </p>
                  <div className="mp-settings-key-chip">
                    API Key:{" "}
                    {settingsSnap?.finikConfigured ? "••••••••••••" : "—"}
                  </div>
                  <div className="mp-settings-field">
                    <label
                      htmlFor="platform-settings-finik-draft"
                      className="mp-settings-field__label"
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
                    <p className="mp-settings-field__hint">
                      Оставьте поле пустым и сохраните, чтобы отключить Finik.
                    </p>
                  </div>
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
                    className="mp-settings-btn-secondary"
                  >
                    {finikSaving ? "Сохранение…" : "Сохранить ключ Finik"}
                  </button>
                </div>

                {!isPlatformAdmin && settingsSnap != null ? (
                  <div className="mp-settings-section mp-settings-section--accent">
                    <div className="mp-settings-section__head">
                      <span className="mp-settings-section__title">
                        Продление подписки
                      </span>
                    </div>
                    <p className="mp-settings-section__desc">
                      Оплата откроется на странице Finik вашего магазина.
                    </p>
                    <div className="mp-plan-grid" role="group" aria-label="Тарифы подписки">
                      {SAAS_SUBSCRIPTION_PLANS.map((plan) => {
                        const busy = payPlanBusy === plan.days;
                        const anyBusy = payPlanBusy !== null;
                        const finikReady = settingsSnap.finikConfigured;
                        return (
                          <button
                            key={plan.days}
                            type="button"
                            disabled={!finikReady || anyBusy}
                            aria-busy={busy}
                            onClick={() =>
                              void handleClientSubscriptionPay(plan.days)
                            }
                            className={[
                              "mp-plan-card",
                              plan.featured ? "mp-plan-card--featured" : "",
                              busy ? "mp-plan-card--busy" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <div className="min-w-0 flex-1">
                              {plan.badge ? (
                                <span className="mp-plan-card__badge">
                                  {plan.badge}
                                </span>
                              ) : null}
                              <div className="mp-plan-card__title">
                                {plan.title}
                              </div>
                              <div className="mp-plan-card__subtitle">
                                {plan.subtitle}
                                <span className="text-[#64748b]">
                                  {" "}
                                  · {saasPricePerDayLabel(plan.amountSom, plan.days)}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="mp-plan-card__price">
                                {formatSaasPriceSom(plan.amountSom)}
                              </div>
                              <div
                                className={
                                  busy
                                    ? "mp-plan-card__cta"
                                    : "mp-plan-card__cta mp-plan-card__cta--muted"
                                }
                              >
                                {busy ? "Открываем оплату…" : "Оплатить →"}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {!settingsSnap.finikConfigured ? (
                      <p className="mp-settings-field__hint text-[#fcd34d]">
                        Сначала подключите Finik выше и сохраните API-ключ.
                      </p>
                    ) : (
                      <p className="mp-settings-field__hint">
                        Нужны API key и secret в личном кабинете Finik магазина.
                      </p>
                    )}
                  </div>
                ) : null}
                </div>

                <div className="mp-settings-save-footer">
                  {settingsErr ? (
                    <p className="text-sm text-red-300" role="alert">
                      {settingsErr}
                    </p>
                  ) : null}
                  {settingsOkMsg ? (
                    <p className="text-sm text-[#86EFAC]" role="status">
                      {settingsOkMsg}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      settingsSnap == null || settingsSaving || settingsLoading
                    }
                    className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-2"
                  >
                    {settingsSaving ? "Сохранение…" : "Сохранить настройки"}
                  </button>
                </div>
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
