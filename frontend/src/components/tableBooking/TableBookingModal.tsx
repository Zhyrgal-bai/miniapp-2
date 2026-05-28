import { useEffect, useState, type FormEvent } from "react";
import type { CustomerDiningTableDto, TableSlotDto } from "../../services/tableBookingApi";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayName } from "../../utils/telegramUserMark";

type Props = {
  open: boolean;
  table: CustomerDiningTableDto | null;
  storeName: string;
  slots: TableSlotDto[];
  slotsLoading: boolean;
  dateYmd: string;
  onDateChange: (date: string) => void;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    reservedAt: string;
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote: string;
  }) => void;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TableBookingModal({
  open,
  table,
  storeName,
  slots,
  slotsLoading,
  dateYmd,
  onDateChange,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestNote, setGuestNote] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TableSlotDto | null>(null);

  useEffect(() => {
    if (!open || !table) return;
    setPartySize(Math.min(2, table.seats));
    setSelectedSlot(null);
    const u = getTelegramUser();
    if (u) {
      const name = telegramDisplayName(u);
      if (name) setGuestName(name);
      if (u.username) setGuestPhone(`@${u.username}`);
    }
  }, [open, table?.id]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [dateYmd, table?.id]);

  if (!open || !table) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSlot?.reservedAt) return;
    onSubmit({
      reservedAt: selectedSlot.reservedAt,
      partySize,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestNote: guestNote.trim(),
    });
  };

  return (
    <div className="table-booking-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="table-booking-modal"
        role="dialog"
        aria-labelledby="table-booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="table-booking-modal__head">
          <div>
            <p className="table-booking-modal__eyebrow">{storeName}</p>
            <h2 id="table-booking-title" className="table-booking-modal__title">
              {table.name}
            </h2>
            <p className="table-booking-modal__meta">
              до {table.seats} гостей · {table.shape === "VIP" ? "VIP зона" : "основной зал"}
            </p>
          </div>
          <button type="button" className="table-booking-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>

        <form className="table-booking-modal__form" onSubmit={handleSubmit}>
          <label className="table-booking-field">
            <span>Дата</span>
            <input
              type="date"
              value={dateYmd}
              min={todayYmd()}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>

          <div className="table-booking-field">
            <span>Время</span>
            {slotsLoading ? (
              <p className="table-booking-muted">Загрузка слотов…</p>
            ) : (
              <div className="table-booking-slots">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    className={[
                      "table-booking-slot",
                      selectedSlot?.time === slot.time ? "is-selected" : "",
                      !slot.available ? "is-busy" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="table-booking-field">
            <span>Имя</span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Как к вам обращаться"
              required
              maxLength={80}
            />
          </label>

          <label className="table-booking-field">
            <span>Телефон</span>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+996 …"
              required
              maxLength={32}
            />
          </label>

          <label className="table-booking-field">
            <span>Гостей</span>
            <input
              type="number"
              min={1}
              max={table.seats}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              required
            />
          </label>

          <label className="table-booking-field">
            <span>Комментарий</span>
            <textarea
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              placeholder="Пожелания, детское кресло…"
              rows={2}
              maxLength={500}
            />
          </label>

          {error ? (
            <p className="table-booking-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="table-booking-submit"
            disabled={saving || !selectedSlot || guestName.trim() === "" || guestPhone.trim() === ""}
          >
            {saving ? "Бронируем…" : "Подтвердить бронь"}
          </button>
        </form>
      </div>
    </div>
  );
}
