import { useEffect, useState, type FormEvent } from "react";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayName } from "../../utils/telegramUserMark";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote: string;
    preferredAt?: string;
  }) => void;
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WaitlistJoinModal({ open, saving, error, onClose, onSubmit }: Props) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestNote, setGuestNote] = useState("");
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [timeHm, setTimeHm] = useState("19:00");

  useEffect(() => {
    if (!open) return;
    const u = getTelegramUser();
    if (u?.first_name) setGuestName(telegramDisplayName(u));
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const preferredAt = `${dateYmd}T${timeHm}:00`;
    onSubmit({
      partySize,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestNote: guestNote.trim(),
      preferredAt,
    });
  };

  return (
    <div className="table-booking-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="table-booking-modal"
        role="dialog"
        aria-labelledby="waitlist-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="waitlist-modal-title" className="table-booking-modal__title">
          📋 Встать в очередь
        </h2>
        <p className="table-booking-modal__lead">
          Свободных столиков сейчас нет. Мы сообщим, когда появится место.
        </p>

        <form className="table-booking-form" onSubmit={handleSubmit}>
          <label className="table-booking-form__field">
            Имя
            <input
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="table-booking-form__field">
            Телефон
            <input
              required
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              maxLength={32}
            />
          </label>
          <label className="table-booking-form__field">
            Гостей
            <input
              required
              type="number"
              min={1}
              max={40}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            />
          </label>
          <label className="table-booking-form__field">
            Желаемое время
            <div className="table-booking-form__row">
              <input
                type="date"
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
              />
              <input
                type="time"
                value={timeHm}
                onChange={(e) => setTimeHm(e.target.value)}
              />
            </div>
          </label>
          <label className="table-booking-form__field">
            Комментарий
            <textarea
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </label>

          {error ? (
            <p className="table-booking-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="table-booking-form__actions">
            <button type="button" className="is-muted" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Отправка…" : "Встать в очередь"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
