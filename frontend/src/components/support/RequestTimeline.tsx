import { requestTimelineSteps } from "@repo-shared/orderRequestLabels";
import "./supportUi.css";

type RequestTimelineProps = {
  kind: "cancel" | "refund" | "return";
  status: string;
};

export function RequestTimeline({ kind, status }: RequestTimelineProps) {
  const steps = requestTimelineSteps(kind, status);
  return (
    <ol className="sf-request-timeline" aria-label="Статус заявки">
      {steps.map((step) => (
        <li
          key={step.label}
          className={`sf-request-timeline__step${step.done ? " sf-request-timeline__step--done" : ""}${step.current ? " sf-request-timeline__step--current" : ""}`}
        >
          <span className="sf-request-timeline__dot" aria-hidden />
          {step.label}
        </li>
      ))}
    </ol>
  );
}
