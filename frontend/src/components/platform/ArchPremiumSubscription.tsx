import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchMerchantSubscriptionPanel,
  fetchSubscriptionPaymentHistory,
  patchSubscriptionAutoRenew,
  postPlatformSubscriptionPaymentCreate,
  type MerchantSubscriptionPanelPayload,
  type MerchantSubscriptionPlanDTO,
  type MerchantSubscriptionUiStatus,
  type SubscriptionPaymentHistoryRow,
} from "../../services/platformApi";
import {
  buildTrialSubscriptionJourney,
  formatSaasPriceSom,
  saasPricePerDayLabel,
} from "@repo-shared/saasSubscriptionPricing";
import { formatAdminApiError } from "../../utils/adminApiError";
import { getTelegramWebApp } from "../../utils/telegram";
import { useLiveCountdown } from "../../hooks/useLiveCountdown";
import {
  finikAvailabilityMessage,
  SUBSCRIPTION_STATUS_CLASS,
  subscriptionTariffLabel,
} from "../../utils/subscriptionUx";
import { ru } from "../../i18n/ru";
import {
  formatDaysRemaining,
  formatRuDateShort,
} from "../../pages/platform/platformUi";
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

function unitLabel(value: number, one: string, few: string, many: string): string {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function progressPercent(
  panel: MerchantSubscriptionPanelPayload,
  countdownMs: number | null,
): number | null {
  if (countdownMs == null || countdownMs <= 0) return null;
  if (panel.displayStatus === "TRIAL") {
    const cap = Math.max(panel.daysLeft ?? 1, 14);
    const left = panel.daysLeft ?? 0;
    return Math.min(100, Math.max(4, (left / cap) * 100));
  }
  if (panel.subscriptionEndsAt != null) {
    return Math.min(
      100,
      Math.max(0, (countdownMs / (30 * 86400000)) * 100),
    );
  }
  return null;
}

function progressBarClass(status: MerchantSubscriptionUiStatus): string {
  if (status === "EXPIRING") return "archa-sub__progress-bar--expiring";
  if (status === "GRACE") return "archa-sub__progress-bar--grace";
  if (status === "EXPIRED") return "archa-sub__progress-bar--expired";
  return "";
}

export function ArchPremiumSubscription({
  businessId,
  telegramId,
  variant = "dashboard",
  sectionRef,
  onPaid,
}: Props) {
  const embedded = variant === "settings";
  const [panel, setPanel] = useState<MerchantSubscriptionPanelPayload | null>(
    null,
  );
  const [payments, setPayments] = useState<SubscriptionPaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<
    "MONTHLY" | "HALF_YEAR" | "YEARLY" | null
  >(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [autoRenewBusy, setAutoRenewBusy] = useState(false);

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

  const endIso = panel != null ? primaryEndIso(panel) : null;
  const { parts: countdownParts } = useLiveCountdown(endIso);
  const daysLabel = formatDaysRemaining(endIso);
  const tariffLabel = panel != null ? subscriptionTariffLabel(panel) : "—";
  const finikMsg = panel != null ? finikAvailabilityMessage(panel) : null;
  const journey = useMemo(
    () => (panel?.displayStatus === "TRIAL" ? buildTrialSubscriptionJourney() : []),
    [panel?.displayStatus],
  );

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
        "Откроется страница оплаты. После успешной оплаты подписка продлится автоматически.",
      );
      setRenewOpen(false);
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

  const showRenew =
    panel != null &&
    (panel.displayStatus === "EXPIRED" ||
      panel.displayStatus === "GRACE" ||
      panel.displayStatus === "EXPIRING" ||
      (panel.daysLeft != null && panel.daysLeft <= 14));

  const progressPct =
    panel != null ? progressPercent(panel, panel.countdownMs) : null;

  const countdownTitle =
    panel?.displayStatus === "TRIAL"
      ? "Пробный период"
      : panel?.inGracePeriod
        ? ru.platform.gracePeriod
        : "Осталось";

  const content = (
    <>
      {!embedded ? (
        <div className="archa-sub__head">
          <h2 className="archa-sub__head-title">💎 Подписка</h2>
          <button
            type="button"
            className="mp-btn mp-btn--ghost mp-btn--sm archa-sub__refresh"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "…" : "Проверить статус"}
          </button>
        </div>
      ) : (
        <div className="archa-sub__head">
          <button
            type="button"
            className="mp-btn mp-btn--ghost mp-btn--sm archa-sub__refresh"
            disabled={loading}
            onClick={() => void load()}
            style={{ marginLeft: "auto" }}
          >
            {loading ? "…" : "Проверить статус"}
          </button>
        </div>
      )}

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
          <div className="archa-sub__top">
            <span
              className={[
                "archa-sub__badge",
                SUBSCRIPTION_STATUS_CLASS[panel.displayStatus],
              ].join(" ")}
            >
              {panel.displayStatus === "TRIAL"
                ? "🟢 Пробный период"
                : panel.displayStatusLabel}
            </span>
            {!panel.storeOpenForCustomers ? (
              <span className="archa-sub__store-closed">
                Витрина закрыта для покупателей
              </span>
            ) : (
              <span className="archa-sub__store-open">Магазин открыт</span>
            )}
          </div>

          {panel.inGracePeriod ? (
            <p className="archa-sub__hint archa-sub__hint--grace" role="status">
              {ru.platform.gracePeriodHint}
            </p>
          ) : null}

          {countdownParts != null && countdownParts.totalMs > 0 ? (
            <div className="archa-sub__countdown" aria-live="polite">
              <p className="archa-sub__countdown-label">{countdownTitle}</p>
              <div className="archa-sub__countdown-grid">
                <div className="archa-sub__countdown-unit">
                  <div className="archa-sub__countdown-value">
                    {countdownParts.days}
                  </div>
                  <div className="archa-sub__countdown-name">
                    {unitLabel(
                      countdownParts.days,
                      "день",
                      "дня",
                      "дней",
                    )}
                  </div>
                </div>
                <div className="archa-sub__countdown-unit">
                  <div className="archa-sub__countdown-value">
                    {countdownParts.hours}
                  </div>
                  <div className="archa-sub__countdown-name">
                    {unitLabel(
                      countdownParts.hours,
                      "час",
                      "часа",
                      "часов",
                    )}
                  </div>
                </div>
                <div className="archa-sub__countdown-unit">
                  <div className="archa-sub__countdown-value">
                    {countdownParts.minutes}
                  </div>
                  <div className="archa-sub__countdown-name">
                    {unitLabel(
                      countdownParts.minutes,
                      "минута",
                      "минуты",
                      "минут",
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {progressPct != null ? (
            <div className="archa-sub__progress" aria-hidden="true">
              <div
                className={[
                  "archa-sub__progress-bar",
                  progressBarClass(panel.displayStatus),
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}

          <dl className="archa-sub__meta">
            <div>
              <dt>Текущий тариф</dt>
              <dd>{tariffLabel}</dd>
            </div>
            <div>
              <dt>Окончание</dt>
              <dd>{formatRuDateShort(endIso) ?? tariffLabel}</dd>
            </div>
            <div>
              <dt>Осталось</dt>
              <dd>
                {countdownParts != null && countdownParts.totalMs > 0
                  ? `${countdownParts.days} ${unitLabel(countdownParts.days, "день", "дня", "дней")}, ${countdownParts.hours} ${unitLabel(countdownParts.hours, "час", "часа", "часов")}`
                  : daysLabel ?? tariffLabel}
              </dd>
            </div>
            {panel.displayStatus !== "TRIAL" ? (
              <div>
                <dt>Автопродление</dt>
                <dd>{panel.autoRenewEnabled ? "Включено" : "Выключено"}</dd>
              </div>
            ) : null}
          </dl>

          {panel.displayStatus === "TRIAL" && journey.length > 0 ? (
            <>
              <div className="archa-sub__journey">
                <h3 className="archa-sub__journey-title">Следующий шаг</h3>
                {journey
                  .filter((s) => s.phase === "next")
                  .map((step) => (
                    <div
                      key={step.id}
                      className="archa-sub__journey-step archa-sub__journey-step--next"
                    >
                      <div className="archa-sub__journey-left">
                        <div className="archa-sub__journey-name">
                          {step.icon} {step.title}
                        </div>
                        {step.subtitle ? (
                          <div className="archa-sub__journey-sub">
                            {step.subtitle}
                          </div>
                        ) : null}
                      </div>
                      {step.priceLabel ? (
                        <div className="archa-sub__journey-price">
                          {step.priceLabel}
                        </div>
                      ) : null}
                    </div>
                  ))}
                <h3 className="archa-sub__journey-title" style={{ marginTop: "0.75rem" }}>
                  Далее
                </h3>
                {journey
                  .filter((s) => s.phase === "later")
                  .map((step) => (
                    <div key={step.id} className="archa-sub__journey-step">
                      <div className="archa-sub__journey-left">
                        <div className="archa-sub__journey-name">
                          {step.icon} {step.title}
                        </div>
                        {step.subtitle ? (
                          <div className="archa-sub__journey-sub">
                            {step.subtitle}
                          </div>
                        ) : null}
                      </div>
                      {step.priceLabel ? (
                        <div className="archa-sub__journey-price">
                          {step.priceLabel}
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>

              <div className="archa-sub__timeline">
                <h3 className="archa-sub__timeline-title">Ваш путь</h3>
                <ol className="archa-sub__timeline-list">
                  {journey.map((step) => (
                    <li key={step.id} className="archa-sub__timeline-item">
                      <span className="archa-sub__timeline-icon" aria-hidden>
                        {step.icon}
                      </span>
                      <div className="archa-sub__timeline-body">
                        <div className="archa-sub__timeline-title-text">
                          {step.title}
                        </div>
                        {step.subtitle ? (
                          <div className="archa-sub__timeline-sub">
                            {step.subtitle}
                          </div>
                        ) : null}
                        {step.priceLabel ? (
                          <div className="archa-sub__timeline-price">
                            {step.priceLabel}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}

          {panel.isOwner ? (
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
          ) : finikMsg != null ? (
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
          ) : panel.canPay ? (
            <>
              {showRenew && !renewOpen ? (
                <button
                  type="button"
                  className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg"
                  onClick={() => setRenewOpen(true)}
                >
                  Продлить подписку
                </button>
              ) : null}

              {(renewOpen || !showRenew) &&
              (panel.displayStatus !== "TRIAL" || renewOpen) ? (
                <>
                  <p className="archa-sub__pay-lead">
                    {showRenew
                      ? "Выберите тариф для продления."
                      : "Оплатите заранее, чтобы не прерывать работу магазина."}
                  </p>
                  <div
                    className="mp-plan-grid"
                    role="group"
                    aria-label="Тарифы подписки"
                  >
                    {panel.plans.map((plan) => {
                      const busy = payBusy === plan.code;
                      const anyBusy = payBusy !== null;
                      return (
                        <button
                          key={plan.code}
                          type="button"
                          disabled={anyBusy}
                          aria-busy={busy}
                          onClick={() => void handlePay(plan)}
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
                            <div className="mp-plan-card__title">{plan.title}</div>
                            <div className="mp-plan-card__subtitle">
                              {plan.subtitle}
                              <span className="text-[#64748b]">
                                {" "}
                                ·{" "}
                                {saasPricePerDayLabel(
                                  plan.amountSom,
                                  plan.totalMonths,
                                )}
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
                              {busy ? "Открываем…" : "Оплатить →"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {renewOpen ? (
                    <button
                      type="button"
                      className="mp-btn mp-btn--ghost mp-btn--sm mt-2"
                      onClick={() => setRenewOpen(false)}
                    >
                      Скрыть тарифы
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
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
