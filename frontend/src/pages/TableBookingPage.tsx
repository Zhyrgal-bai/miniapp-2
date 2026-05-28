import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { CustomerTableMap } from "../components/tableBooking/CustomerTableMap";
import { TableBookingModal } from "../components/tableBooking/TableBookingModal";
import {
  createTableReservation,
  fetchCustomerDiningTables,
  fetchTableSlots,
  type CustomerDiningTableDto,
  type TableSlotDto,
} from "../services/tableBookingApi";
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

  const loadTables = useCallback(async () => {
    if (businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerDiningTables(businessId);
      setTables(data.tables);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить карту");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

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
      setSuccess("Бронь подтверждена! Сообщение придёт в Telegram.");
      void loadTables();
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

      <div className="table-booking-legend">
        <span className="table-booking-legend__item table-booking-legend__item--free">Свободен</span>
        <span className="table-booking-legend__item table-booking-legend__item--soon">Скоро занят</span>
        <span className="table-booking-legend__item table-booking-legend__item--busy">Занят</span>
      </div>

      {loading ? <p className="table-booking-muted">Загрузка карты…</p> : null}

      {!loading ? <CustomerTableMap tables={tables} selectedId={selected?.id ?? null} onSelect={onSelectTable} /> : null}

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
    </div>
  );
}
