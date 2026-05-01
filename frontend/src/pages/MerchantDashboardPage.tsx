import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTelegramWebApp } from "../utils/telegram";
import { getWebAppUserId } from "../utils/telegramUserId";
import {
  fetchMerchantBusinesses,
  type MerchantBusinessCardDTO,
} from "../services/merchantDashboardApi";
import "./MerchantDashboardPage.css";

function statusRu(row: MerchantBusinessCardDTO): string {
  switch (row.accessState) {
    case "paused":
      return "Магазин выключен";
    case "pay_required":
      return "Оплатите";
    case "active":
    default:
      return "Активен";
  }
}

function badgeClass(row: MerchantBusinessCardDTO): string {
  if (row.accessState === "active") return "mdb-card__badge--ok";
  if (row.accessState === "paused") return "mdb-card__badge--muted";
  return "mdb-card__badge--warn";
}

/** Mini App SaaS: витрина магазинов аккаунта (как у BotFather карточками). */
export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MerchantBusinessCardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tgId = getWebAppUserId();
    if (!Number.isFinite(tgId) || tgId <= 0) {
      setErr("Откройте страницу внутри Telegram (Mini App).");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchMerchantBusinesses({ telegramId: tgId });
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    getTelegramWebApp()?.expand?.();
    void load();
  }, [load]);

  const openStore = (id: number) => {
    navigate(`/?shop=${encodeURIComponent(String(id))}`);
  };

  const openSettings = (id: number) => {
    navigate(`/?shop=${encodeURIComponent(String(id))}&view=merchant-settings`);
  };

  const userId = getWebAppUserId();

  return (
    <div className="mdb">
      <header className="mdb__head">
        <h1 className="mdb__title">Личный кабинет</h1>
        <p className="mdb__subtitle">Ваши магазины и подписка</p>
      </header>

      {loading ? (
        <p className="mdb__muted">Загрузка…</p>
      ) : err ? (
        <p className="mdb__err" role="alert">
          {err}
        </p>
      ) : rows.length === 0 ? (
        <div className="mdb__empty" role="status">
          <p className="mdb__empty-title">Пока нет магазинов с правами OWNER/ADMIN.</p>
          <p className="mdb__empty-hint">
            Зарегистрируйтесь через /start платформы и дождитесь одобрения заявки.
          </p>
        </div>
      ) : (
        <ul className="mdb__list">
          {rows.map((row) => (
            <li key={row.id} className="mdb-card">
              <div className="mdb-card__row">
                <span className="mdb-card__emoji" aria-hidden>
                  🏪
                </span>
                <div className="mdb-card__body">
                  <h2 className="mdb-card__name">{row.name}</h2>
                  <p className="mdb-card__id">id {row.id}</p>
                </div>
              </div>
              <div className="mdb-card__meta">
                <span className={`mdb-card__badge ${badgeClass(row)}`}>
                  💰 {statusRu(row)}
                </span>
                <span className="mdb-card__badge mdb-card__badge--muted">
                  {row.isActive ? "Витрина: вкл." : "Витрина: выкл."}
                </span>
              </div>
              <div className="mdb-card__meta">
                <span className="mdb-card__date">
                  📅{" "}
                  {row.daysLeft != null
                    ? `${row.daysLeft} дн. по текущему периоду`
                    : row.accessState === "active" &&
                        row.trialEndsAt == null &&
                        row.subscriptionEndsAt == null
                      ? "Срок без ограничения"
                      : "Срок нужно продлить"}
                </span>
                <span className="mdb-card__sub">{row.subscriptionStatus}</span>
              </div>
              <div className="mdb-card__actions">
                <button
                  type="button"
                  className="mdb-btn mdb-btn--primary"
                  onClick={() => openStore(row.id)}
                >
                  Открыть магазин
                </button>
                <button
                  type="button"
                  className="mdb-btn"
                  onClick={() => openSettings(row.id)}
                >
                  Настройки
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="mdb__foot">
        <span className="mdb__muted">
          Telegram id:{" "}
          {Number.isFinite(userId) && userId > 0 ? userId : "—"}
        </span>
      </footer>
    </div>
  );
}
