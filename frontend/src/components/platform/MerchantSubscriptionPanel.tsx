import { useCallback, useEffect, useState } from "react";
import {
  fetchMerchantSubscriptionPanel,
  postPlatformSubscriptionPaymentCreate,
  type MerchantSubscriptionPanelPayload,
  type MerchantSubscriptionUiStatus,
} from "../../services/platformApi";
import {
  formatSaasPriceSom,
  SAAS_SUBSCRIPTION_PLANS,
  saasPricePerDayLabel,
} from "@repo-shared/saasSubscriptionPricing";
import { formatAdminApiError } from "../../utils/adminApiError";
import { getTelegramWebApp } from "../../utils/telegram";
import { formatDaysRemaining, formatRuDateShort } from "../../pages/platform/platformUi";

const STATUS_CLASS: Record<MerchantSubscriptionUiStatus, string> = {
  ACTIVE: "mp-sub-panel__badge--active",
  TRIAL: "mp-sub-panel__badge--trial",
  EXPIRED: "mp-sub-panel__badge--expired",
};

const STATUS_LABEL: Record<MerchantSubscriptionUiStatus, string> = {
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  EXPIRED: "EXPIRED",
};

function primaryEndIso(panel: MerchantSubscriptionPanelPayload): string | null {
  if (panel.displayStatus === "TRIAL" && panel.trialEndsAt) {
    return panel.trialEndsAt;
  }
  return panel.subscriptionEndsAt ?? panel.trialEndsAt;
}

type Props = {
  businessId: number;
  telegramId: number;
  sectionRef?: React.RefObject<HTMLElement | null>;
  onPaid?: () => void;
};

export function MerchantSubscriptionPanel({
  businessId,
  telegramId,
  sectionRef,
  onPaid,
}: Props) {
  const [panel, setPanel] = useState<MerchantSubscriptionPanelPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<30 | 90 | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (businessId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchMerchantSubscriptionPanel(businessId);
      setPanel(p);
    } catch (e) {
      setPanel(null);
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePay = async (plan: 30 | 90) => {
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      setError("Нет данных Telegram для оплаты.");
      return;
    }
    setPayBusy(plan);
    setError(null);
    setPayMsg(null);
    try {
      const out = await postPlatformSubscriptionPaymentCreate({
        telegramId,
        businessId,
        plan,
      });
      const tg = getTelegramWebApp() as { openLink?: (url: string) => void } | undefined;
      tg?.openLink?.(out.paymentUrl);
      setPayMsg("Откроется страница оплаты Finik. После успешной оплаты магазин откроется автоматически.");
      onPaid?.();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setPayBusy(null);
    }
  };

  const endIso = panel != null ? primaryEndIso(panel) : null;
  const daysLabel =
    panel?.daysLeft != null ? formatDaysRemaining(panel.daysLeft) : null;

  const showRenew =
    panel != null &&
    (panel.displayStatus === "EXPIRED" ||
      (panel.daysLeft != null && panel.daysLeft <= 7));

  return (
    <section
      ref={sectionRef}
      className="mp-sub-panel"
      aria-label="Подписка"
      id="merchant-subscription"
    >
      <div className="mp-sub-panel__head">
        <h2 className="mp-v2-section-title">Подписка</h2>
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
              {STATUS_LABEL[panel.displayStatus]}
            </span>
            {!panel.storeOpenForCustomers ? (
              <span className="mp-sub-panel__store-closed">
                Витрина закрыта для покупателей
              </span>
            ) : (
              <span className="mp-sub-panel__store-open">Магазин открыт</span>
            )}
          </div>

          <dl className="mp-sub-panel__meta">
            <div>
              <dt>Окончание</dt>
              <dd>{formatRuDateShort(endIso) ?? "—"}</dd>
            </div>
            <div>
              <dt>Осталось</dt>
              <dd>{daysLabel ?? "—"}</dd>
            </div>
          </dl>

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
              <p className="mp-sub-panel__pay-lead">
                {showRenew
                  ? "Продлите подписку — витрина и заказы снова заработают сразу после оплаты."
                  : "Оплатите заранее, чтобы не прерывать работу магазина."}
              </p>
              <div className="mp-plan-grid" role="group" aria-label="Тарифы подписки">
                {SAAS_SUBSCRIPTION_PLANS.map((plan) => {
                  const busy = payBusy === plan.days;
                  const anyBusy = payBusy !== null;
                  return (
                    <button
                      key={plan.days}
                      type="button"
                      disabled={anyBusy}
                      aria-busy={busy}
                      onClick={() => void handlePay(plan.days)}
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
                          <span className="mp-plan-card__badge">{plan.badge}</span>
                        ) : null}
                        <div className="mp-plan-card__title">{plan.title}</div>
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
                          {busy
                            ? "Открываем…"
                            : showRenew
                              ? "Продлить →"
                              : "Оплатить →"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mp-sub-panel__actions">
                {showRenew ? (
                  <p className="mp-sub-panel__action-label">Продлить подписку</p>
                ) : (
                  <p className="mp-sub-panel__action-label">Оплатить сейчас</p>
                )}
              </div>
            </>
          ) : null}

          {payMsg ? (
            <p className="mp-sub-panel__ok" role="status">
              {payMsg}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
