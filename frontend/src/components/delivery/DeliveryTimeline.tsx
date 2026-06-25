import { memo } from "react";
import type { DeliveryUiEvent } from "../../types/deliveryAdmin.types";
import { TIMELINE_KIND_META, formatDeliveryDate } from "./deliveryUtils";

type DeliveryTimelineProps = {
  events: DeliveryUiEvent[];
  loading?: boolean;
};

export const DeliveryTimeline = memo(function DeliveryTimeline({
  events,
  loading = false,
}: DeliveryTimelineProps) {
  if (loading) {
    return (
      <div className="dlv-skeleton" style={{ height: 180 }} aria-hidden />
    );
  }
  if (events.length === 0) {
    return (
      <p className="dlv-drawer-kv__k">Событий пока нет</p>
    );
  }
  return (
    <ol className="dlv-timeline" aria-label="Хронология доставки">
      {events.map((ev, idx) => {
        const meta = TIMELINE_KIND_META[ev.kind] ?? { icon: "•", label: ev.kind };
        return (
          <li
            key={ev.id}
            className={`dlv-timeline__item${idx < events.length - 1 ? " dlv-timeline__item--done" : ""}`}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="dlv-timeline__title">
              <span className="dlv-timeline__icon" aria-hidden>
                {meta.icon}
              </span>
              {ev.title || meta.label}
            </div>
            {ev.detail ? (
              <div className="dlv-timeline__meta">{ev.detail}</div>
            ) : null}
            <div className="dlv-timeline__meta">
              {formatDeliveryDate(ev.occurredAt)}
              {ev.actor ? ` · ${ev.actor}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
});
