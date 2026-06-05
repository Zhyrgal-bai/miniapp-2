import { useCallback, useEffect, useState } from "react";
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
  formatSaasPriceSom,
  saasPricePerDayLabel,
} from "@repo-shared/saasSubscriptionPricing";
import { formatAdminApiError } from "../../utils/adminApiError";
import { getTelegramWebApp } from "../../utils/telegram";
import {
  formatDaysRemaining,
  formatRuDateShort,
  formatSubscriptionCountdown,
} from "../../pages/platform/platformUi";

const STATUS_CLASS: Record<MerchantSubscriptionUiStatus, string> = {
  ACTIVE: "mp-sub-panel__badge--active",
  TRIAL: "mp-sub-panel__badge--trial",
  EXPIRING: "mp-sub-panel__badge--trial",
  GRACE: "mp-sub-panel__badge--expired",
  EXPIRED: "mp-sub-panel__badge--expired",
};

type Props = {
  businessId: number;
  telegramId: number;
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

export function MerchantSubscriptionPanel({
  businessId,
  telegramId,
  sectionRef,
  onPaid,
}: Props) {
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

  const endIso = panel != null ? primaryEndIso(panel) : null;
  const countdownLabel = formatSubscriptionCountdown(panel?.countdownMs ?? null);
  const daysLabel = formatDaysRemaining(endIso);

  const showRenew =
    panel != null &&
    (panel.displayStatus === "EXPIRED" ||
      panel.displayStatus === "GRACE" ||
      panel.displayStatus === "EXPIRING" ||
      (panel.daysLeft != null && panel.daysLeft <= 14));

  const progressPct =
    panel != null &&
    panel.countdownMs != null &&
    panel.subscriptionEndsAt != null
      ? Math.min(
          100,
          Math.max(
            0,
            (panel.countdownMs /
              Math.max(panel.countdownMs, 30 * 86400000)) *
              100,
          ),
        )
      : null;

  return (
    <section
      ref={sectionRef}
      className="mp-sub-panel archa-glass-panel"
      aria-label="Подписка"
      id="merchant-subscription"
    >
      <div className="mp-sub-panel__head">
        <h2 className="mp-v2-section-title">💎 Подписка</h2>
        <button
          type="button"
          className="mp-btn mp-btn--ghost mp-btn--sm"
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
        <p className="mp-sub-panel__err" role="alert">
          {error}
        </p>
      ) : null}

      {panel != null ? (
        <div className="mp-sub-panel__card">
          <div className="mp-sub-panel__row">
            <span
              className={[
                "mp-sub-panel__badge",
                STATUS_CLASS[panel.displayStatus],
              ].join(" ")}
            >
              {panel.displayStatusLabel}
            </span>
            {!panel.storeOpenForCustomers ? (
              <span className="mp-sub-panel__store-closed">
                Витрина закрыта для покупателей
              </span>
            ) : (
              <span className="mp-sub-panel__store-open">Магазин открыт</span>
            )}
          </div>

          {panel.inGracePeriod ? (
            <p className="mp-sub-panel__hint mp-sub-panel__hint--warn" role="status">
              Grace period: магазин работает, но подписка просрочена. Продлите
              как можно скорее.
            </p>
          ) : null}

          {progressPct != null ? (
            <div className="mp-sub-progress" aria-hidden="true">
              <div
                className="mp-sub-progress__bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}

          <dl className="mp-sub-panel__meta">
            <div>
              <dt>Текущий тариф</dt>
              <dd>{panel.subscriptionPlanLabel}</dd>
            </div>
            <div>
              <dt>Окончание</dt>
              <dd>{formatRuDateShort(endIso) ?? "—"}</dd>
            </div>
            <div>
              <dt>Осталось</dt>
              <dd>{countdownLabel ?? daysLabel ?? "—"}</dd>
            </div>
          </dl>

          {panel.isOwner ? (
            <label className="mp-sub-auto-renew">
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
            <p className="mp-sub-panel__blocked" role="alert">
              Магазин заблокирован оператором платформы. Оплата недоступна.
            </p>
          ) : null}

          {!panel.isOwner ? (
            <p className="mp-sub-panel__hint">
              Оплатить подписку может только владелец магазина.
            </p>
          ) : !panel.platformFinikReady ? (
            <p className="mp-sub-panel__hint mp-sub-panel__hint--warn">
              Онлайн-оплата временно недоступна. Напишите в поддержку платформы.
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

              {(renewOpen || !showRenew) && (
                <>
                  <p className="mp-sub-panel__pay-lead">
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
              )}
            </>
          ) : null}

          {payMsg ? (
            <p className="mp-sub-panel__ok" role="status">
              {payMsg}
            </p>
          ) : null}

          {payments.length > 0 ? (
            <div className="mp-sub-history">
              <h3 className="mp-sub-history__title">История подписки</h3>
              <ul className="mp-sub-history__list">
                {payments.map((row) => {
                  const srcLabel = historySourceLabel(row.source);
                  return (
                  <li key={String(row.id)} className="mp-sub-history__row">
                    <div className="mp-sub-history__main">
                      <span className="mp-sub-history__date">
                        {formatRuDateShort(row.createdAt) ?? row.createdAt}
                      </span>
                      <span className="mp-sub-history__plan">
                        {row.planLabel}
                        {srcLabel ? (
                          <span className="text-[#64748b]"> · {srcLabel}</span>
                        ) : null}
                      </span>
                      <span
                        className={[
                          "mp-sub-history__status",
                          row.status === "completed" || row.status === "applied"
                            ? "mp-sub-history__status--ok"
                            : "",
                        ].join(" ")}
                      >
                        {paymentStatusLabel(row.status, row.entryType)}
                      </span>
                    </div>
                    <div className="mp-sub-history__meta">
                      <span>
                        {row.amountSom != null
                          ? formatSaasPriceSom(row.amountSom)
                          : "—"}
                      </span>
                      {row.finikPaymentId ? (
                        <span className="mp-sub-history__id" title="ID платежа">
                          #{row.finikPaymentId.slice(0, 12)}
                          {row.finikPaymentId.length > 12 ? "…" : ""}
                        </span>
                      ) : row.entryType === "operator_extension" ? (
                        <span className="mp-sub-history__id">оператор</span>
                      ) : (
                        <span className="mp-sub-history__id">#{String(row.id)}</span>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
