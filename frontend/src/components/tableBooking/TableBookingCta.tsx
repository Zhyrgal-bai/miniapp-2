import type { ReactElement } from "react";

type Props = {
  onPress: () => void;
  compact?: boolean;
};

export function TableBookingCta({ onPress, compact = false }: Props): ReactElement {
  return (
    <button
      type="button"
      className={`table-booking-cta${compact ? " table-booking-cta--compact" : ""}`}
      onClick={onPress}
    >
      <span className="table-booking-cta__icon" aria-hidden>
        🍽
      </span>
      <span className="table-booking-cta__copy">
        <span className="table-booking-cta__title">Забронировать столик</span>
        <span className="table-booking-cta__sub">Выберите стол и время за минуту</span>
      </span>
      <span className="table-booking-cta__arrow" aria-hidden>
        →
      </span>
    </button>
  );
}
