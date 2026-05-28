import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import {
  businessTypeSupportsTableReservations,
  RESERVATION_STATUS_LABELS,
  type TableReservationStatus,
} from "@repo-shared/tableReservation";
import { adminService } from "../../services/admin.service";
import {
  fetchMerchantReservationsAdmin,
  updateMerchantReservationStatus,
  type ReservationFilter,
} from "../../services/merchantReservationsApi";
import type { TableReservationDto } from "../../services/tableBookingApi";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./adminReservations.css";

const FILTERS: { id: ReservationFilter; label: string }[] = [
  { id: "upcoming", label: "Предстоящие" },
  { id: "active", label: "Сейчас в зале" },
  { id: "cancelled", label: "Отмены" },
  { id: "completed", label: "Завершённые" },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReservationsPage(): ReactElement {
  const { businessId } = useShop();
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReservationFilter>("upcoming");
  const [rows, setRows] = useState<TableReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = businessTypeSupportsTableReservations(businessType);

  const load = useCallback(async () => {
    if (businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const schema = await adminService.getMerchantSchemas();
      setBusinessType(String(schema.businessType ?? ""));
      const data = await fetchMerchantReservationsAdmin(businessId, filter);
      setRows(data.reservations);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, status: string) => {
    if (businessId == null) return;
    setSavingId(id);
    try {
      await updateMerchantReservationStatus(businessId, id, status);
      await load();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (businessId == null) {
    return (
      <div className="admin-dash-page">
        <p className="admin-dash-page__muted">Магазин не выбран.</p>
      </div>
    );
  }

  if (!loading && !supported) {
    return (
      <div className="admin-dash-page">
        <header className="admin-dash-page__head">
          <h1 className="admin-dash-page__title">Брони</h1>
        </header>
        <p className="admin-dash-page__muted">Доступно только для кофеен и фастфуда.</p>
      </div>
    );
  }

  return (
    <div className="admin-dash-page reservations-admin-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">📅 Брони</h1>
        <p className="admin-dash-page__subtitle">Управление бронированиями столиков</p>
      </header>

      <div className="reservations-admin-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "is-on" : ""}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <p className="admin-dash-page__muted">Загрузка…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="admin-dash-page__muted">Нет броней в этой категории.</p>
      ) : null}

      <ul className="reservations-admin-list">
        {rows.map((r) => (
          <li key={r.id} className="reservations-admin-card">
            <div className="reservations-admin-card__main">
              <p className="reservations-admin-card__table">
                {r.tableName ?? `Стол #${r.tableId}`}
              </p>
              <p className="reservations-admin-card__when">{formatWhen(r.reservedAt)}</p>
              <p className="reservations-admin-card__guest">
                {r.guestName ?? "Гость"} · {r.guestPhone ?? "—"} · {r.partySize ?? "?"} гостей
              </p>
              {r.guestNote ? (
                <p className="reservations-admin-card__note">{r.guestNote}</p>
              ) : null}
              <span className={`reservations-admin-card__status status-${r.status.toLowerCase()}`}>
                {RESERVATION_STATUS_LABELS[r.status as TableReservationStatus] ?? r.status}
              </span>
            </div>
            <div className="reservations-admin-card__actions">
              {r.status === "PENDING" ? (
                <button
                  type="button"
                  disabled={savingId === r.id}
                  onClick={() => void act(r.id, "CONFIRMED")}
                >
                  Подтвердить
                </button>
              ) : null}
              {(r.status === "CONFIRMED" || r.status === "PENDING") && (
                <>
                  <button
                    type="button"
                    disabled={savingId === r.id}
                    onClick={() => void act(r.id, "ARRIVED")}
                  >
                    Пришёл
                  </button>
                  <button
                    type="button"
                    className="is-muted"
                    disabled={savingId === r.id}
                    onClick={() => void act(r.id, "NO_SHOW")}
                  >
                    No-show
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={savingId === r.id}
                    onClick={() => void act(r.id, "CANCELLED")}
                  >
                    Отменить
                  </button>
                </>
              )}
              {r.status === "ARRIVED" ? (
                <button
                  type="button"
                  disabled={savingId === r.id}
                  onClick={() => void act(r.id, "COMPLETED")}
                >
                  Завершить
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
