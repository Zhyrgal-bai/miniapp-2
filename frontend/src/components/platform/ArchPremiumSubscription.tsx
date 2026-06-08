import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchMerchantSubscriptionPanel,
  fetchSubscriptionPaymentHistory,
  patchSubscriptionAutoRenew,
  postPlatformSubscriptionPaymentCreate,
  type MerchantSubscriptionPanelPayload,
  type MerchantSubscriptionPlanDTO,
  type MerchantSubscriptionPlanCode,
  type SubscriptionPaymentHistoryRow,
} from "../../services/platformApi";
import { formatSaasPriceSom } from "@repo-shared/saasSubscriptionPricing";
import { formatAdminApiError } from "../../utils/adminApiError";
import { getTelegramWebApp } from "../../utils/telegram";
import { useLiveCountdown } from "../../hooks/useLiveCountdown";
import {
  finikAvailabilityMessage,
  platformFinikStatusLabel,
  SUBSCRIPTION_STATUS_CLASS,
} from "../../utils/subscriptionUx";
import { ru } from "../../i18n/ru";
import { formatRuDateShort } from "../../pages/platform/platformUi";
import { SubscriptionPricingCard } from "./SubscriptionPricingCard";
import { sortSubscriptionPlans } from "./subscriptionPlanPresentation";
import "./ArchPremiumSubscription.css";

export type ArchPremiumSubscriptionVariant = "dashboard" | "settings";

type Props = {
  businessId: number;
  telegramId: number;
  variant?: ArchPremiumSubscriptionVariant;
  sectionRef?: React.RefObject<HTMLElement | null>;
  onPaid?: () => void;
};

function primaryEndIso(panel: MerchantSubscriptionPanelPayload): string | null {
  if (panel.inGracePeriod && panel.gracePeriodEndsAt) {
    return panel.gracePeriodEndsAt;
  }
  if (panel.displayStatus === "TRIAL" && panel.trialEndsAt) {
    return panel.trialEndsAt;
  }
  return panel.subscriptionEndsAt ?? panel.trialEndsAt;
}

function paymentStatusLabel(status: string, entryType?: string): string {
  if (entryType === "operator_extension") return "Применено";
  const s = status.toLowerCase();
  if (s === "completed" || s === "applied") return "Оплачен";
  if (s === "pending") return "Ожидает";
  if (s === "failed") return "Ошибка";
  return status;
}

function historySourceLabel(source: string): string | null {
  if (source === "auto_renew") return "автопродление";
  if (source === "operator") return "оператор";
  if (source === "manual") return "оплата";
  return null;
}

function statusBadgeLabel(panel: MerchantSubscriptionPanelPayload): string {
  if (panel.displayStatus === "TRIAL") return "🟢 Пробный период";
  if (panel.displayStatus === "PENDING_PAYMENT") return "⏳ Ожидает оплаты";
  return panel.displayStatusLabel;
}

function unitLabel(value: number, one: string, few: string, many: string): string {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function formatCountdownShort(parts: {
  days: number;
  hours: number;
  minutes: number;
}): string {
  const segments: string[] = [];
  if (parts.days > 0) {
    segments.push(
      `${parts.days} ${unitLabel(parts.days, "день", "дня", "дней")}`,
    );
  }
  if (parts.hours > 0 || parts.days === 0) {
    segments.push(
      `${parts.hours} ${unitLabel(parts.hours, "час", "часа", "часов")}`,
    );
  }
  if (parts.days === 0 && parts.hours === 0) {
    segments.push(
      `${parts.minutes} ${unitLabel(parts.minutes, "минута", "минуты", "минут")}`,
    );
  }
  return segments.join(" ");
}

function defaultSelectedPlan(
  plans: MerchantSubscriptionPlanDTO[],
  panel: MerchantSubscriptionPanelPayload,
): MerchantSubscriptionPlanCode | null {
  const sorted = sortSubscriptionPlans(plans);
  if (sorted.length === 0) return null;
  if (panel.firstMonthEligible) {
    const first = sorted.find((p) => p.code === "FIRST_MONTH");
    return first?.code ?? sorted[0]!.code;
  }
  const yearly = sorted.find((p) => p.code === "YEARLY" && p.featured);
  return yearly?.code ?? sorted[0]!.code;
}

export function ArchPremiumSubscription({
  businessId,
  telegramId,
  variant = "dashboard",
  sectionRef,
  onPaid,
}: Props) {
  const embedded = variant === "settings";
  const pricingRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<MerchantSubscriptionPanelPayload | null>(
    null,
  );
  const [payments, setPayments] = useState<SubscriptionPaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<MerchantSubscriptionPlanCode | null>(
    null,
  );
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [autoRenewBusy, setAutoRenewBusy] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] =
    useState<MerchantSubscriptionPlanCode | null>(null);

  const load = useCallback(async () => {
    if (businessId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const [p, history] = await Promise.all([
        fetchMerchantSubscriptionPanel(businessId),
        fetchSubscriptionPaymentHistory(businessId).catch(() => []),
      ]);
      setPanel(p);
      setPayments(history);
      setSelectedPlanCode((prev) => {
        if (prev != null && p.plans.some((plan) => plan.code === prev)) {
          return prev;
        }
        return defaultSelectedPlan(p.plans, p);
      });
    } catch (e) {
      setPanel(null);
      setPayments([]);
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (panel?.displayStatus !== "PENDING_PAYMENT") return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [panel?.displayStatus, load]);

  const endIso = panel != null ? primaryEndIso(panel) : null;
  const { parts: countdownParts } = useLiveCountdown(endIso);
  const finikMsg = panel != null ? finikAvailabilityMessage(panel) : null;

  const sortedPlans = useMemo(
    () => (panel != null ? sortSubscriptionPlans(panel.plans) : []),
    [panel],
  );

  const selectedPlan =
    sortedPlans.find((p) => p.code === selectedPlanCode) ?? sortedPlans[0];

  const handlePay = async (plan: MerchantSubscriptionPlanDTO) => {
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      setError("Нет данных Telegram для оплаты.");
      return;
    }
    setPayBusy(plan.code);
    setError(null);
    setPayMsg(null);
    try {
      const out = await postPlatformSubscriptionPaymentCreate({
        telegramId,
        businessId,
        planCode: plan.code,
      });
      const tg = getTelegramWebApp() as { openLink?: (url: string) => void } | undefined;
      tg?.openLink?.(out.paymentUrl);
      setPayMsg(
        "Откроется страница оплаты Finik. После успешной оплаты подписка продлится автоматически.",
      );
      void load();
      onPaid?.();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPayBusy(null);
    }
  };

  const handleAutoRenewToggle = async () => {
    if (panel == null) return;
    setAutoRenewBusy(true);
    setError(null);
    try {
      const next = await patchSubscriptionAutoRenew({
        businessId,
        enabled: !panel.autoRenewEnabled,
      });
      setPanel({ ...panel, autoRenewEnabled: next });
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setAutoRenewBusy(false);
    }
  };

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handlePayNow = () => {
    scrollToPricing();
    if (selectedPlan != null) {
      setSelectedPlanCode(selectedPlan.code);
    }
  };

  const showPricing =
    panel != null &&
    panel.isOwner &&
    panel.displayStatus !== "PENDING_PAYMENT" &&
    sortedPlans.length > 0;

  const paymentAllowed = panel?.canPay === true;

  const content = (
    <>
      <div className="archa-sub__head">
        <div className="archa-sub__head-copy">
          {!embedded ? (
            <>
              <h2 className="archa-sub__head-title">Подписка ARCHA</h2>
              <p className="archa-sub__head-sub">
                Управляйте магазином без ограничений.
              </p>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="mp-btn mp-btn--ghost mp-btn--sm archa-sub__refresh"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "…" : "Обновить"}
        </button>
      </div>

      {loading && panel == null ? (
        <p className="mp-muted text-sm">Загрузка…</p>
      ) : null}

      {error ? (
        <p className="archa-sub__err" role="alert">
          {error}
        </p>
      ) : null}

      {panel != null ? (
        <motion.div
          className="archa-sub__shell archa-glass archa-glass--glow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="archa-sub__status-row">
            <span
              className={[
                "archa-sub__badge",
                SUBSCRIPTION_STATUS_CLASS[panel.displayStatus],
              ].join(" ")}
            >
              {statusBadgeLabel(panel)}
            </span>
            <span
              className={[
                "archa-sub__finik",
                panel.platformFinikPayReady
                  ? "archa-sub__finik--ok"
                  : panel.platformFinikReady
                    ? "archa-sub__finik--warn"
                    : "archa-sub__finik--bad",
              ].join(" ")}
            >
              {platformFinikStatusLabel(panel)}
            </span>
            {!panel.storeOpenForCustomers ? (
              <span className="archa-sub__store-closed">
                Витрина закрыта
              </span>
            ) : (
              <span className="archa-sub__store-open">Магазин открыт</span>
            )}
          </div>

          {panel.displayStatus === "PENDING_PAYMENT" ? (
            <p className="archa-sub__hint archa-sub__hint--info" role="status">
              Ожидаем подтверждение оплаты от Finik. Статус обновится автоматически.
            </p>
          ) : null}

          {panel.displayStatus === "TRIAL" &&
          countdownParts != null &&
          countdownParts.totalMs > 0 ? (
            <div className="archa-sub__trial-banner">
              <div className="archa-sub__trial-banner-copy">
                <p className="archa-sub__trial-banner-title">
                  🟢 Пробный период активен
                </p>
                <p className="archa-sub__trial-banner-countdown">
                  <span className="archa-sub__trial-banner-label">Осталось:</span>
                  <span className="archa-sub__trial-banner-value">
                    {formatCountdownShort(countdownParts)}
                  </span>
                </p>
              </div>
              {panel.isOwner && showPricing ? (
                <button
                  type="button"
                  className="mp-btn mp-btn--primary archa-sub__trial-banner-cta"
                  disabled={payBusy !== null}
                  onClick={handlePayNow}
                >
                  {paymentAllowed ? "Оплатить сейчас" : "Смотреть тарифы"}
                </button>
              ) : null}
            </div>
          ) : null}

          {panel.inGracePeriod ? (
            <p className="archa-sub__hint archa-sub__hint--grace" role="status">
              {ru.platform.gracePeriodHint}
            </p>
          ) : null}

          {panel.displayStatus !== "TRIAL" &&
          endIso != null &&
          countdownParts != null &&
          countdownParts.totalMs > 0 ? (
            <div className="archa-sub__renewal-strip">
              <span className="archa-sub__renewal-label">
                {panel.inGracePeriod ? ru.platform.gracePeriod : "Подписка до"}
              </span>
              <span className="archa-sub__renewal-value">
                {formatRuDateShort(endIso) ?? "—"}
                {" · "}
                {formatCountdownShort(countdownParts)}
              </span>
            </div>
          ) : null}

          {showPricing ? (
            <section
              ref={pricingRef}
              className="archa-sub__pricing"
              aria-label="Тарифы подписки"
            >
              <div
                className="archa-sub__pricing-track"
                role="list"
                aria-label={`${sortedPlans.length} тарифов`}
              >
                {sortedPlans.map((plan) => {
                  const busy = payBusy === plan.code;
                  const anyBusy = payBusy !== null;
                  return (
                    <div
                      key={plan.code}
                      className="archa-sub__pricing-slide"
                      role="listitem"
                    >
                      <SubscriptionPricingCard
                        plan={plan}
                        selected={selectedPlanCode === plan.code}
                        canPay={paymentAllowed}
                        disabled={anyBusy}
                        busy={busy}
                        onSelect={() => setSelectedPlanCode(plan.code)}
                        onPay={() => {
                          if (!paymentAllowed) return;
                          void handlePay(plan);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {panel.isOwner && panel.displayStatus !== "TRIAL" ? (
            <label className="archa-sub__auto-renew">
              <input
                type="checkbox"
                checked={panel.autoRenewEnabled}
                disabled={autoRenewBusy || !panel.canPay}
                onChange={() => void handleAutoRenewToggle()}
              />
              <span>
                Автопродление — счёт Finik за 3 дня до окончания (без
                автосписания)
              </span>
            </label>
          ) : null}

          {panel.isBlocked ? (
            <p className="archa-sub__blocked" role="alert">
              Магазин заблокирован оператором платформы. Оплата недоступна.
            </p>
          ) : null}

          {!panel.isOwner ? (
            <p className="archa-sub__hint">
              Оплатить подписку может только владелец магазина.
            </p>
          ) : finikMsg != null && !paymentAllowed ? (
            <p
              className={[
                "archa-sub__hint",
                finikMsg.kind === "info"
                  ? "archa-sub__hint--info"
                  : "archa-sub__hint--warn",
              ].join(" ")}
            >
              {finikMsg.text}
            </p>
          ) : !showPricing &&
            panel.isOwner &&
            panel.displayStatus !== "PENDING_PAYMENT" ? (
            <p className="archa-sub__hint">
              Тарифы временно недоступны. Обновите страницу или обратитесь в поддержку.
            </p>
          ) : null}

          {payMsg ? (
            <p className="archa-sub__ok" role="status">
              {payMsg}
            </p>
          ) : null}

          {payments.length > 0 ? (
            <div className="archa-sub__history">
              <h3 className="archa-sub__history-title">История подписки</h3>
              <ul className="archa-sub__history-list">
                {payments.map((row) => {
                  const srcLabel = historySourceLabel(row.source);
                  return (
                    <li key={String(row.id)} className="archa-sub__history-row">
                      <div className="archa-sub__history-main">
                        <span className="archa-sub__history-date">
                          {formatRuDateShort(row.createdAt) ?? row.createdAt}
                        </span>
                        <span className="archa-sub__history-plan">
                          {row.planLabel}
                          {srcLabel ? (
                            <span className="text-[#64748b]"> · {srcLabel}</span>
                          ) : null}
                        </span>
                        <span
                          className={[
                            "archa-sub__history-status",
                            row.status === "completed" || row.status === "applied"
                              ? "archa-sub__history-status--ok"
                              : "",
                          ].join(" ")}
                        >
                          {paymentStatusLabel(row.status, row.entryType)}
                        </span>
                      </div>
                      <div className="archa-sub__history-meta">
                        <span>
                          {row.amountSom != null
                            ? formatSaasPriceSom(row.amountSom)
                            : "—"}
                        </span>
                        {row.finikPaymentId ? (
                          <span className="archa-sub__history-id" title="ID платежа">
                            #{row.finikPaymentId.slice(0, 12)}
                            {row.finikPaymentId.length > 12 ? "…" : ""}
                          </span>
                        ) : row.entryType === "operator_extension" ? (
                          <span className="archa-sub__history-id">оператор</span>
                        ) : (
                          <span className="archa-sub__history-id">
                            #{String(row.id)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="archa-sub archa-sub--embedded" aria-label="Подписка">
        {content}
      </div>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="archa-sub"
      aria-label="Подписка"
      id="merchant-subscription"
    >
      {content}
    </section>
  );
}

/** @deprecated Используйте ArchPremiumSubscription */
export const MerchantSubscriptionPanel = ArchPremiumSubscription;
