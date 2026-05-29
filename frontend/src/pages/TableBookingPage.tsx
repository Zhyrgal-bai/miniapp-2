import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { CustomerTableMap } from "../components/tableBooking/CustomerTableMap";
import { TableBookingModal } from "../components/tableBooking/TableBookingModal";
import { WaitlistJoinModal } from "../components/tableBooking/WaitlistJoinModal";
import {
  createTableReservation,
  fetchCustomerDiningTables,
  fetchMyTableReservations,
  fetchTableSlots,
  payReservationDeposit,
  syncReservationDeposit,
  type CustomerDiningTableDto,
  type TableReservationDto,
  type TableSlotDto,
} from "../services/tableBookingApi";
import { RESERVATION_STATUS_LABELS, type TableReservationStatus } from "@repo-shared/tableReservation";
import { waitlistStatusLabel, type WaitlistEntryStatus } from "@repo-shared/waitlist";
import {
  acceptWaitlistInvite,
  fetchMyWaitlistEntries,
  joinWaitlist,
  type WaitlistEntryDto,
} from "../services/waitlistApi";
import { openTelegramExternalLink } from "../utils/telegramWebAppBootstrap";
import { getTelegramUser } from "../utils/telegram";
import "../pages/admin/adminTables.css";
import "../components/tableBooking/tableBooking.css";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  onBack: () => void;
};

export default function TableBookingPage({ onBack }: Props): ReactElement {
  const { businessId } = useShop();
  const { payload } = useStorefrontPayload();
  const supported = businessTypeSupportsTableReservations(payload?.businessType);
  const storeName = payload?.storeName?.trim() || "Кафе";

  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<CustomerDiningTableDto[]>([]);
  const [selected, setSelected] = useState<CustomerDiningTableDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [slots, setSlots] = useState<TableSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<TableReservationDto[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [depositPayingId, setDepositPayingId] = useState<number | null>(null);
  const [hasBookableTables, setHasBookableTables] = useState(true);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSaving, setWaitlistSaving] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [myWaitlist, setMyWaitlist] = useState<WaitlistEntryDto[]>([]);
  const [waitlistPosition, setWaitlistPosition] = useState(0);

  const loadMyWaitlist = useCallback(async () => {
    if (businessId == null) return;
    try {
      const data = await fetchMyWaitlistEntries(businessId);
      setMyWaitlist(Array.isArray(data.entries) ? data.entries : []);
      setWaitlistPosition(data.queuePosition ?? 0);
    } catch {
      setMyWaitlist([]);
      setWaitlistPosition(0);
    }
  }, [businessId]);

  const loadMyReservations = useCallback(async () => {
    if (businessId == null) return;
    setMyLoading(true);
    try {
      const data = await fetchMyTableReservations(businessId);
      setMyReservations(Array.isArray(data.reservations) ? data.reservations : []);
    } catch {
      setMyReservations([]);
    } finally {
      setMyLoading(false);
    }
  }, [businessId]);

  const onPayDeposit = async (reservationId: number) => {
    if (businessId == null) return;
    setDepositPayingId(reservationId);
    setError(null);
    try {
      const { paymentUrl } = await payReservationDeposit(businessId, reservationId);
      openTelegramExternalLink(paymentUrl);
      window.setTimeout(() => {
        void syncReservationDeposit(businessId, reservationId)
          .then(() => loadMyReservations())
          .catch(() => undefined);
      }, 4000);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "";
      setError(msg || (e instanceof Error ? e.message : "Не удалось оплатить депозит"));
    } finally {
      setDepositPayingId(null);
    }
  };

  const loadTables = useCallback(async () => {
    if (businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerDiningTables(businessId);
      if (import.meta.env.DEV) {
        console.info("[TableBooking] dining-tables response", {
          businessId,
          supported: data.supported,
          count: data.tables?.length ?? 0,
          tables: data.tables,
        });
      }
      if (!data.supported) {
        setError("Бронирование столиков недоступно для этого магазина.");
        setTables([]);
        return;
      }
      setTables(Array.isArray(data.tables) ? data.tables : []);
      const bookable =
        data.hasBookableTables ??
        (Array.isArray(data.tables) ? data.tables.some((t) => t.bookable) : false);
      setHasBookableTables(bookable);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить карту");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadTables();
    void loadMyReservations();
    void loadMyWaitlist();
  }, [loadTables, loadMyReservations, loadMyWaitlist]);

  useEffect(() => {
    const onPreorderDone = () => void loadMyReservations();
    window.addEventListener("sf:preorderCompleted", onPreorderDone);
    return () => window.removeEventListener("sf:preorderCompleted", onPreorderDone);
  }, [loadMyReservations]);

  const loadSlots = useCallback(async () => {
    if (businessId == null || !selected) return;
    setSlotsLoading(true);
    try {
      const data = await fetchTableSlots(businessId, selected.id, dateYmd);
      setSlots(data.slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [businessId, selected, dateYmd]);

  useEffect(() => {
    if (modalOpen && selected) void loadSlots();
  }, [modalOpen, selected, loadSlots]);

  useEffect(() => {
    const u = getTelegramUser();
    if (u?.first_name && modalOpen) {
      // prefill handled in modal via key - optional future
    }
  }, [modalOpen]);

  const onSelectTable = (table: CustomerDiningTableDto) => {
    setSelected(table);
    setModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async (form: {
    reservedAt: string;
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote: string;
  }) => {
    if (businessId == null || !selected) return;
    setSaving(true);
    setError(null);
    try {
      await createTableReservation(businessId, {
        tableId: selected.id,
        ...form,
      });
      setModalOpen(false);
      setSuccess("Заявка отправлена! Ожидайте подтверждения в Telegram.");
      void loadTables();
      void loadMyReservations();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "";
      setError(msg || (e instanceof Error ? e.message : "Не удалось забронировать"));
    } finally {
      setSaving(false);
    }
  };

  const onJoinWaitlist = async (form: {
    partySize: number;
    guestName: string;
    guestPhone: string;
    guestNote: string;
    preferredAt?: string;
  }) => {
    if (businessId == null) return;
    setWaitlistSaving(true);
    setWaitlistError(null);
    try {
      await joinWaitlist(businessId, form);
      setWaitlistOpen(false);
      setSuccess("Вы в очереди! Мы напишем в Telegram, когда освободится стол.");
      void loadMyWaitlist();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "";
      setWaitlistError(msg || (e instanceof Error ? e.message : "Не удалось встать в очередь"));
    } finally {
      setWaitlistSaving(false);
    }
  };

  const onAcceptWaitlist = async (entryId: number) => {
    if (businessId == null) return;
    try {
      await acceptWaitlistInvite(businessId, entryId);
      setSuccess("Столик забронирован! Ждём вас.");
      void loadMyWaitlist();
      void loadMyReservations();
      void loadTables();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "")
          : "";
      setError(msg || (e instanceof Error ? e.message : "Не удалось принять приглашение"));
    }
  };

  if (!supported) {
    return (
      <div className="table-booking-page">
        <button type="button" className="table-booking-back" onClick={onBack}>
          ← Назад
        </button>
        <p className="table-booking-muted">Бронирование столиков недоступно.</p>
      </div>
    );
  }

  return (
    <div className="table-booking-page">
      <header className="table-booking-page__head">
        <button type="button" className="table-booking-back" onClick={onBack}>
          ← Назад
        </button>
        <h1 className="table-booking-page__title">🍽 Забронировать столик</h1>
        <p className="table-booking-page__lead">
          Выберите стол на схеме зала {storeName !== "Кафе" ? `«${storeName}»` : ""}
        </p>
      </header>

      <section className="table-booking-my" aria-labelledby="table-booking-my-title">
        <h2 id="table-booking-my-title" className="table-booking-my__title">
          Мои брони
        </h2>
        {myLoading ? <p className="table-booking-muted">Загрузка…</p> : null}
        {!myLoading && myReservations.length === 0 ? (
          <p className="table-booking-muted">У вас пока нет броней в этом магазине.</p>
        ) : null}
        {!myLoading && myReservations.length > 0 ? (
          <ul className="table-booking-my__list">
            {myReservations.map((r) => {
              const when = new Date(r.reservedAt).toLocaleString("ru-RU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
              const statusLabel =
                RESERVATION_STATUS_LABELS[r.status as TableReservationStatus] ?? r.status;
              return (
                <li key={r.id} className="table-booking-my__card">
                  <p className="table-booking-my__table">
                    {r.tableName ?? `Стол #${r.tableId}`} · {when}
                  </p>
                  <p className="table-booking-my__status">{statusLabel}</p>
                  <p className="table-booking-my__preorder">
                    Предзаказ: {r.preorderLabel ?? (r.hasPreorder ? "Предзаказ создан" : "Нет предзаказа")}
                  </p>
                  <p className="table-booking-my__deposit">
                    Депозит: {r.depositLabel ?? "Не требуется"}
                    {r.depositAmount != null && r.depositStatus === "DEPOSIT_PENDING"
                      ? ` · ${r.depositAmount} сом`
                      : ""}
                  </p>
                  {r.canPayDeposit ? (
                    <button
                      type="button"
                      className="table-booking-my__deposit-btn"
                      disabled={depositPayingId === r.id}
                      onClick={() => void onPayDeposit(r.id)}
                    >
                      {depositPayingId === r.id ? "Открываем оплату…" : "💳 Оплатить депозит"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {myWaitlist.length > 0 ? (
        <section className="table-booking-my" aria-labelledby="table-booking-waitlist-title">
          <h2 id="table-booking-waitlist-title" className="table-booking-my__title">
            Моя очередь
          </h2>
          <ul className="table-booking-my__list">
            {myWaitlist.map((w) => (
              <li key={w.id} className="table-booking-my__card">
                <p className="table-booking-my__table">
                  {w.partySize} гостей
                  {w.tableName ? ` · ${w.tableName}` : ""}
                </p>
                <p className="table-booking-my__status">
                  {waitlistStatusLabel(w.status as WaitlistEntryStatus)}
                  {w.status === "WAITING" && waitlistPosition > 0
                    ? ` · место ${waitlistPosition}`
                    : ""}
                </p>
                {w.status === "INVITED" ? (
                  <button
                    type="button"
                    className="table-booking-my__deposit-btn"
                    onClick={() => void onAcceptWaitlist(w.id)}
                  >
                    ✅ Забрать столик
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && tables.length > 0 && !hasBookableTables && myWaitlist.length === 0 ? (
        <div className="table-booking-waitlist-cta">
          <p className="table-booking-waitlist-cta__text">
            Сейчас все столики заняты. Встаньте в очередь — мы сообщим в Telegram.
          </p>
          <button type="button" onClick={() => setWaitlistOpen(true)}>
            📋 Встать в очередь
          </button>
        </div>
      ) : null}

      <div className="table-booking-legend">
        <span className="table-booking-legend__item table-booking-legend__item--free">Свободен</span>
        <span className="table-booking-legend__item table-booking-legend__item--soon">Скоро занят</span>
        <span className="table-booking-legend__item table-booking-legend__item--busy">Занят</span>
      </div>

      {loading ? <p className="table-booking-muted">Загрузка карты…</p> : null}

      {error && !modalOpen ? (
        <div className="table-booking-error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && tables.length === 0 && !error ? (
        <p className="table-booking-muted">
          Столики ещё не настроены. Добавьте их в админке → «Столики».
        </p>
      ) : null}

      {!loading && tables.length > 0 ? (
        <CustomerTableMap tables={tables} selectedId={selected?.id ?? null} onSelect={onSelectTable} />
      ) : null}

      {success ? (
        <div className="table-booking-success" role="status">
          {success}
        </div>
      ) : null}

      <TableBookingModal
        open={modalOpen}
        table={selected}
        storeName={storeName}
        slots={slots}
        slotsLoading={slotsLoading}
        dateYmd={dateYmd}
        onDateChange={setDateYmd}
        saving={saving}
        error={error}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
      />

      <WaitlistJoinModal
        open={waitlistOpen}
        saving={waitlistSaving}
        error={waitlistError}
        onClose={() => {
          setWaitlistOpen(false);
          setWaitlistError(null);
        }}
        onSubmit={onJoinWaitlist}
      />
    </div>
  );
}
