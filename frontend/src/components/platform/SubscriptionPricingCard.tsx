import type {
  MerchantSubscriptionPlanCode,
  MerchantSubscriptionPlanDTO,
} from "../../services/platformApi";
import { formatSaasPriceSom } from "@repo-shared/saasSubscriptionPricing";
import {
  planPresentation,
  ribbonLabel,
} from "./subscriptionPlanPresentation";

type Props = {
  plan: MerchantSubscriptionPlanDTO;
  selected: boolean;
  disabled: boolean;
  busy: boolean;
  onSelect: () => void;
  onPay: () => void;
};

export function SubscriptionPricingCard({
  plan,
  selected,
  disabled,
  busy,
  onSelect,
  onPay,
}: Props) {
  const pres = planPresentation(plan);
  const isMonthly = plan.code === "MONTHLY";

  return (
    <article
      className={[
        "archa-sub__pricing-card",
        selected ? "archa-sub__pricing-card--selected" : "",
        pres.ribbon === "best" ? "archa-sub__pricing-card--best" : "",
        pres.ribbon === "popular" ? "archa-sub__pricing-card--popular" : "",
        busy ? "archa-sub__pricing-card--busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={`plan-title-${plan.code}`}
    >
      {pres.ribbon != null ? (
        <span className="archa-sub__pricing-ribbon">
          {ribbonLabel(pres.ribbon)}
        </span>
      ) : plan.badge && plan.code !== "YEARLY" ? (
        <span className="archa-sub__pricing-ribbon archa-sub__pricing-ribbon--muted">
          {plan.badge}
        </span>
      ) : null}

      <button
        type="button"
        className="archa-sub__pricing-card-hit"
        disabled={disabled}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <div className="archa-sub__pricing-card-head">
          <span className="archa-sub__pricing-icon" aria-hidden>
            {pres.icon}
          </span>
          <h3
            className="archa-sub__pricing-name"
            id={`plan-title-${plan.code}`}
          >
            {plan.title}
          </h3>
        </div>

        <div className="archa-sub__pricing-price-row">
          <span className="archa-sub__pricing-price">
            {formatSaasPriceSom(plan.amountSom)}
          </span>
          {pres.priceSuffix != null || isMonthly ? (
            <span className="archa-sub__pricing-price-suffix">
              {pres.priceSuffix ?? "/ месяц"}
            </span>
          ) : null}
        </div>

        <ul className="archa-sub__pricing-perks">
          {pres.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      </button>

      <button
        type="button"
        className={[
          "archa-sub__pricing-cta",
          selected ? "archa-sub__pricing-cta--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled}
        aria-busy={busy}
        onClick={onPay}
      >
        {busy ? "Открываем…" : "Выбрать"}
      </button>
    </article>
  );
}

export type { MerchantSubscriptionPlanCode };
