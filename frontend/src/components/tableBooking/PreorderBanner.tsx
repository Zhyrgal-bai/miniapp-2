import type { ReactElement } from "react";
import { usePreorderMode } from "../../context/PreorderContext";
import { formatPreorderWhen } from "../../utils/reservationPreorderStorage";
import "./tableBooking.css";

export function PreorderBanner(): ReactElement | null {
  const { context, error, loading } = usePreorderMode();

  if (loading) {
    return (
      <div className="preorder-banner preorder-banner--loading" role="status">
        Проверяем бронь…
      </div>
    );
  }

  if (error) {
    return (
      <div className="preorder-banner preorder-banner--error" role="alert">
        {error}
      </div>
    );
  }

  if (!context) return null;

  const when = formatPreorderWhen(context.reservedAt);

  return (
    <div className="preorder-banner" role="status">
      <p className="preorder-banner__title">
        Предзаказ к брони №{context.reservationId}
      </p>
      <p className="preorder-banner__meta">
        Дата: {when.date}
        <br />
        Время: {when.time}
        <br />
        Столик: {context.tableName}
      </p>
    </div>
  );
}
