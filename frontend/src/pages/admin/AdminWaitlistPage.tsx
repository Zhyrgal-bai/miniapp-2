import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { waitlistStatusLabel, type WaitlistEntryStatus } from "@repo-shared/waitlist";
import { adminService } from "../../services/admin.service";
import {
  cancelMerchantWaitlistEntry,
  fetchMerchantWaitlist,
  type WaitlistBoardDto,
} from "../../services/waitlistApi";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./adminWaitlist.css";

export default function AdminWaitlistPage(): ReactElement {
  const { businessId } = useShop();
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [board, setBoard] = useState<WaitlistBoardDto | null>(null);
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
      const data = await fetchMerchantWaitlist(businessId);
      setBoard(data);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: number) => {
    if (businessId == null) return;
    setSavingId(id);
    try {
      await cancelMerchantWaitlistEntry(businessId, id);
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
          <h1 className="admin-dash-page__title">Очередь</h1>
        </header>
        <p className="admin-dash-page__muted">Доступно только для кофеен и фастфуда.</p>
      </div>
    );
  }

  const analytics = board?.analytics;

  return (
    <div className="admin-dash-page waitlist-admin-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">📋 Очередь</h1>
        <p className="admin-dash-page__subtitle">Лист ожидания и приглашения</p>
      </header>

      {loading ? <p className="admin-dash-page__muted">Загрузка…</p> : null}

      {analytics ? (
        <div className="waitlist-admin-stats">
          <div className="waitlist-admin-stat">
            <span className="waitlist-admin-stat__value">{analytics.waitingCount}</span>
            <span className="waitlist-admin-stat__label">Ожидают</span>
          </div>
          <div className="waitlist-admin-stat">
            <span className="waitlist-admin-stat__value">{analytics.avgWaitMinutes} мин</span>
            <span className="waitlist-admin-stat__label">Среднее ожидание</span>
          </div>
          <div className="waitlist-admin-stat">
            <span className="waitlist-admin-stat__value">{analytics.activeInvitesCount}</span>
            <span className="waitlist-admin-stat__label">Приглашения</span>
          </div>
          <div className="waitlist-admin-stat">
            <span className="waitlist-admin-stat__value">{analytics.seated7d}</span>
            <span className="waitlist-admin-stat__label">Посадили (7д)</span>
          </div>
          <div className="waitlist-admin-stat">
            <span className="waitlist-admin-stat__value">{analytics.left7d}</span>
            <span className="waitlist-admin-stat__label">Ушли (7д)</span>
          </div>
        </div>
      ) : null}

      <section className="waitlist-admin-section">
        <h2 className="waitlist-admin-section__title">Активные приглашения</h2>
        {!loading && (board?.invited.length ?? 0) === 0 ? (
          <p className="admin-dash-page__muted">Нет активных приглашений.</p>
        ) : null}
        <ul className="waitlist-admin-list">
          {(board?.invited ?? []).map((row) => (
            <li key={row.id} className="waitlist-admin-card">
              <p className="waitlist-admin-card__head">
                {row.guestName} · {row.partySize} гостей · {row.tableName ?? "—"}
              </p>
              <p className="waitlist-admin-card__meta">
                {waitlistStatusLabel(row.status as WaitlistEntryStatus)}
                {row.inviteExpiresAt
                  ? ` · до ${new Date(row.inviteExpiresAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
              </p>
              <button
                type="button"
                className="is-muted"
                disabled={savingId === row.id}
                onClick={() => void cancel(row.id)}
              >
                Отменить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="waitlist-admin-section">
        <h2 className="waitlist-admin-section__title">В очереди</h2>
        {!loading && (board?.waiting.length ?? 0) === 0 ? (
          <p className="admin-dash-page__muted">Очередь пуста.</p>
        ) : null}
        <ul className="waitlist-admin-list">
          {(board?.waiting ?? []).map((row, idx) => (
            <li key={row.id} className="waitlist-admin-card">
              <p className="waitlist-admin-card__head">
                #{idx + 1} · {row.guestName} · {row.partySize} гостей
              </p>
              <p className="waitlist-admin-card__meta">
                Ждёт {row.waitMinutes} мин
                {row.preferredAt
                  ? ` · желаемое ${new Date(row.preferredAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
              </p>
              {row.guestNote ? (
                <p className="waitlist-admin-card__note">{row.guestNote}</p>
              ) : null}
              <button
                type="button"
                className="is-danger"
                disabled={savingId === row.id}
                onClick={() => void cancel(row.id)}
              >
                Убрать
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
