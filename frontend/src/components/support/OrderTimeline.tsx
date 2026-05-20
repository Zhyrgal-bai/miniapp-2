import { orderTimelineSteps } from "@repo-shared/supportLabels";
import "./supportUi.css";

type OrderTimelineProps = {
  status: string;
};

export function OrderTimeline({ status }: OrderTimelineProps) {
  const steps = orderTimelineSteps(status);
  return (
    <ol className="sf-order-timeline" aria-label="Статус заказа">
      {steps.map((step, idx) => (
        <li
          key={step.key}
          className={`sf-order-timeline__step sf-order-timeline__step--${step.state}${idx < steps.length - 1 ? " sf-order-timeline__step--has-line" : ""}`}
        >
          <span className="sf-order-timeline__dot" aria-hidden>
            {step.icon}
          </span>
          <span className="sf-order-timeline__label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
