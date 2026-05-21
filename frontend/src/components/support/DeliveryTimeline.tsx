import {
  deliveryModeLabelRu,
  deliveryTimelineSteps,
  type DeliveryMode,
  type DeliveryStage,
} from "@repo-shared/delivery";
import "./supportUi.css";

type DeliveryTimelineProps = {
  deliveryMode?: DeliveryMode | string | null;
  deliveryStage?: DeliveryStage | string | null;
  orderStatus: string;
  estimatedDeliveryAt?: string | null;
};

export function DeliveryTimeline({
  deliveryMode,
  deliveryStage,
  orderStatus,
  estimatedDeliveryAt,
}: DeliveryTimelineProps) {
  const steps = deliveryTimelineSteps({
    deliveryMode: (deliveryMode as DeliveryMode) ?? "DELIVERY",
    deliveryStage: deliveryStage as DeliveryStage | null,
    orderStatus,
  });

  const eta =
    estimatedDeliveryAt != null && estimatedDeliveryAt.trim() !== ""
      ? new Date(estimatedDeliveryAt)
      : null;
  const etaLabel =
    eta != null && !Number.isNaN(eta.getTime())
      ? eta.toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <section className="sf-delivery-timeline" aria-label="Доставка">
      <p className="sf-delivery-timeline__mode">
        {deliveryModeLabelRu((deliveryMode as DeliveryMode) ?? "DELIVERY")}
        {etaLabel ? ` · ожидаем ~${etaLabel}` : null}
      </p>
      <ol className="sf-request-timeline">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`sf-request-timeline__step${step.done ? " sf-request-timeline__step--done" : ""}${step.current ? " sf-request-timeline__step--current" : ""}`}
          >
            <span className="sf-request-timeline__dot" aria-hidden />
            {step.icon} {step.label}
          </li>
        ))}
      </ol>
    </section>
  );
}
