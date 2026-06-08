import { motion } from "framer-motion";
import type { PlatformMyBusinessDTO } from "../../services/platformApi";
import type { MerchantSubscriptionPanelPayload } from "../../services/platformApi";
import type { StoreReadinessPayload } from "../../services/platformApi";
import {
  formatDaysRemaining,
  subscriptionBadge,
  webhookBadge,
  botRunBadge,
} from "../../pages/platform/platformUi";
import { formatSaasPriceSom } from "@repo-shared/saasSubscriptionPricing";
import { resolveFirstMonthPlan } from "../../utils/subscriptionUx";
import "./MerchantPremiumOverview.css";

type Props = {
  business: PlatformMyBusinessDTO;
  subscriptionPanel: MerchantSubscriptionPanelPayload | null;
  readiness: StoreReadinessPayload | null;
  readinessPct: number;
  onOpenOrders: () => void;
  onOpenStore: () => void;
  onOpenSubscription: () => void;
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function MerchantPremiumOverview({
  business: b,
  subscriptionPanel,
  readiness,
  readinessPct,
  onOpenOrders,
  onOpenStore,
  onOpenSubscription,
}: Props) {
  const sub = subscriptionBadge(b.status);
  const wh = webhookBadge(b.webhookStatus);
  const run = botRunBadge(b);
  const subActive = b.subscriptionActive;
  const subRem =
    formatDaysRemaining(b.subscriptionEndsAt) ??
    formatDaysRemaining(b.trialEndsAt);
  const used = Math.max(0, subscriptionPanel?.freeOrdersUsed ?? 0);
  const limit = Math.max(1, subscriptionPanel?.freeOrdersLimit ?? 5);
  const remaining = Math.max(0, subscriptionPanel?.freeOrdersRemaining ?? limit - used);
  const firstMonthPlan =
    subscriptionPanel != null ? resolveFirstMonthPlan(subscriptionPanel) : null;
  const nextStepPrice =
    firstMonthPlan != null ? formatSaasPriceSom(firstMonthPlan.amountSom) : "1500 сом";

  return (
    <motion.section
      className="archa-hub"
      aria-label="Обзор магазина"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div className="archa-hub__stats" variants={item}>
        <div className="archa-hub__stat archa-glass archa-glass--glow">
          <span className="archa-hub__stat-value">{readinessPct}%</span>
          <span className="archa-hub__stat-label">Готовность</span>
        </div>
        <div className="archa-hub__stat archa-glass archa-glass--glow">
          <span className={`archa-hub__stat-value archa-hub__stat-value--${subActive ? "ok" : "warn"}`}>
            {sub.label}
          </span>
          <span className="archa-hub__stat-label">Подписка</span>
        </div>
        <div className="archa-hub__stat archa-glass archa-glass--glow">
          <span className={`archa-hub__stat-value archa-hub__stat-value--${run.className.includes("ok") ? "ok" : "warn"}`}>
            {run.label}
          </span>
          <span className="archa-hub__stat-label">Магазин</span>
        </div>
        <div className="archa-hub__stat archa-glass archa-glass--glow">
          <span className={`archa-hub__stat-value archa-hub__stat-value--${wh.className.includes("ok") ? "ok" : "warn"}`}>
            {wh.label}
          </span>
          <span className="archa-hub__stat-label">Webhook</span>
        </div>
      </motion.div>

      <motion.div className="archa-hub__panels" variants={item}>
        <div className="archa-hub__panel archa-glass archa-glass--glow">
          <div className="archa-hub__panel-head">
            <h3>Статус витрины</h3>
            <span className={`archa-hub__pill ${b.subscriptionActive ? "archa-hub__pill--ok" : "archa-hub__pill--warn"}`}>
              {b.subscriptionActive ? "Открыта" : "Закрыта"}
            </span>
          </div>
          <p className="archa-hub__panel-text">{b.name}</p>
          {subRem ? <p className="archa-hub__panel-meta">{subRem}</p> : null}
          <div className="archa-hub__panel-actions">
            <button type="button" className="archa-hub__link-btn" onClick={onOpenStore}>
              Открыть витрину
            </button>
            {!b.subscriptionActive ? (
              <button type="button" className="archa-hub__link-btn archa-hub__link-btn--accent" onClick={onOpenSubscription}>
                Продлить подписку
              </button>
            ) : null}
          </div>
        </div>

        <div className="archa-hub__panel archa-glass archa-glass--glow">
          <div className="archa-hub__panel-head">
            <h3>Последние заказы</h3>
          </div>
          <p className="archa-hub__panel-text">
            {readiness?.recommendations?.[0] ??
              "Управляйте заказами, статусами и оплатой в реальном времени."}
          </p>
          <button type="button" className="archa-hub__link-btn archa-hub__link-btn--accent" onClick={onOpenOrders}>
            Перейти к заказам →
          </button>
        </div>
      </motion.div>

      {subscriptionPanel != null ? (
        <motion.div className="archa-hub__analytics archa-glass archa-glass--glow" variants={item}>
          <div className="archa-hub__panel-head">
            <h3>Аналитика роста</h3>
          </div>
          <dl className="archa-hub__analytics-grid">
            <div>
              <dt>Получено заказов</dt>
              <dd>{used}</dd>
            </div>
            <div>
              <dt>Использовано</dt>
              <dd>
                {used}/{limit}
              </dd>
            </div>
            <div>
              <dt>Осталось</dt>
              <dd>{remaining}</dd>
            </div>
            <div>
              <dt>Следующий этап</dt>
              <dd>{nextStepPrice}</dd>
            </div>
          </dl>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
