import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminService,
  type AdminOrderListItem,
} from "../../services/admin.service";

const FILTER_TABS = [
  "ALL",
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
] as const;

type FilterTab = (typeof FILTER_TABS)[number];

function canonicalStatus(raw: string): string {
  const t = raw.trim();
  const u = t.toUpperCase();
  if (u === "NEW" || t.toLowerCase() === "new") return "NEW";
  return u;
}

function statusClass(status: string): string {
  return canonicalStatus(status).toLowerCase().replace(/\s+/g, "-");
}

/** Подписи статусов (как на сервере `orderStatusRu`) — для мгновенного обновления списка. */
const ORDER_STATUS_LABEL_RU: Record<string, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  PAID_PENDING: "Ожидает подтверждения оплаты",
  CONFIRMED: "Оплачен",
  SHIPPED: "Отправлен",
  CANCELLED: "Отменён",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyTrackingId, setBusyTrackingId] = useState<number | null>(null);
  const [clearBusy, setClearBusy] = useState<"completed" | "rejected" | "all" | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<number, string>>(
    {}
  );
  const trackingDirtyRef = useRef<Set<number>>(new Set());

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const data = await adminService.fetchOrders();
      setOrders(data);
      setError(null);
    } catch (e) {
      console.error(e);
      if (!opts?.silent) {
        setError("Не удалось загрузить заказы");
        setOrders([]);
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => canonicalStatus(o.status) === filter);
  }, [orders, filter]);

  useEffect(() => {
    setTrackingDraft((prev) => {
      const next = { ...prev };
      for (const o of orders) {
        if (!trackingDirtyRef.current.has(o.id)) {
          next[o.id] = o.tracking ?? "";
        }
      }
      return next;
    });
  }, [orders]);

  async function applyStatus(
    id: number,
    status: "ACCEPTED" | "CONFIRMED" | "SHIPPED" | "CANCELLED"
  ) {
    setBusyId(id);
    try {
      const data = await adminService.updateOrderStatus(id, status);
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const nextStatus =
            data &&
            typeof data === "object" &&
            data !== null &&
            "status" in data &&
            typeof (data as { status: unknown }).status === "string"
              ? (data as { status: string }).status
              : status;
          return {
            ...o,
            status: nextStatus,
            statusText:
              ORDER_STATUS_LABEL_RU[nextStatus] ?? o.statusText,
          };
        })
      );
      void load({ silent: true });
      window.dispatchEvent(new CustomEvent("miniapp:admin-orders-changed"));
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error ? e.message : "Ошибка при обновлении"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveTracking(id: number) {
    const text = (trackingDraft[id] ?? "").trim();
    setBusyTrackingId(id);
    try {
      await adminService.updateOrderTracking(id, text);
      trackingDirtyRef.current.delete(id);
      await load();
      window.dispatchEvent(new CustomEvent("miniapp:admin-orders-changed"));
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error ? e.message : "Не удалось сохранить комментарий"
      );
    } finally {
      setBusyTrackingId(null);
    }
  }

  async function clearOrders(type: "completed" | "rejected" | "all") {
    const ok = window.confirm("Ты уверен?");
    if (!ok) return;
    setClearBusy(type);
    try {
      const deleted = await adminService.clearOrders(type);
      await load();
      window.dispatchEvent(new CustomEvent("miniapp:admin-orders-changed"));
      alert(`Удалено заказов: ${deleted}`);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Не удалось очистить заказы");
    } finally {
      setClearBusy(null);
    }
  }

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Заказы</h1>
        <p className="admin-dash-page__subtitle">
          Заказы из базы; список обновляется каждые 3 с. Кнопки в Telegram
          меняют тот же заказ по номеру.
        </p>
      </header>

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      <div className="admin-filter-tabs" role="tablist" aria-label="Фильтр по статусу">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            className={`admin-filter-tabs__btn${filter === tab ? " admin-filter-tabs__btn--active" : ""}`}
            onClick={() => setFilter(tab)}
          >
            {tab === "ALL" ? "Все" : tab.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="admin-order-clear-actions">
        <button
          type="button"
          className="admin-order-clear-actions__btn"
          disabled={clearBusy !== null}
          onClick={() => void clearOrders("completed")}
        >
          {clearBusy === "completed" ? "Очистка…" : "🧹 Очистить завершенные"}
        </button>
        <button
          type="button"
          className="admin-order-clear-actions__btn"
          disabled={clearBusy !== null}
          onClick={() => void clearOrders("rejected")}
        >
          {clearBusy === "rejected" ? "Очистка…" : "❌ Очистить отклоненные"}
        </button>
        <button
          type="button"
          className="admin-order-clear-actions__btn admin-order-clear-actions__btn--danger"
          disabled={clearBusy !== null}
          onClick={() => void clearOrders("all")}
        >
          {clearBusy === "all" ? "Очистка…" : "💥 Очистить все"}
        </button>
      </div>

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="admin-dash-page__muted">Нет заказов для выбранного фильтра</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="admin-order-grid">
          {filtered.map((order) => {
            const canon = canonicalStatus(order.status);
            const busy = busyId === order.id;
            const busyTr = busyTrackingId === order.id;
            const receiptUrl = order.receiptUrl?.trim() ?? "";
            const hasReceipt = receiptUrl.length > 0;
            const payMethod = (order.paymentMethod ?? "receipt").toLowerCase();
            const isFinik = payMethod === "finik";
            const hasCoords =
              order.lat != null &&
              order.lng != null &&
              Number.isFinite(order.lat) &&
              Number.isFinite(order.lng);
            const deliveryAddress =
              typeof order.address === "string" && order.address.trim() !== ""
                ? order.address.trim()
                : null;
            return (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-card__top">
                  <h2 className="admin-order-card__id">#{order.id}</h2>
                </div>
                <dl className="admin-order-card__dl">
                  <div>
                    <dt>Имя</dt>
                    <dd>{order.name}</dd>
                  </div>
                  <div>
                    <dt>Телефон</dt>
                    <dd>{order.phone}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{order.total} сом</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>
                      <span className={`status ${statusClass(order.status)}`}>
                        {order.statusText}
                      </span>
                      <span className="admin-order-card__code">{canon}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Оплата</dt>
                    <dd>
                      {isFinik ? "Finik" : "Чек / перевод"}
                    </dd>
                  </div>
                </dl>
                <div className="admin-order-card__delivery">
                  <p className="admin-order-card__delivery-title">📍 Доставка</p>
                  <p className="admin-order-card__delivery-address">
                    <span className="admin-order-card__delivery-label">Адрес:</span>{" "}
                    {deliveryAddress ?? "Не указан"}
                  </p>
                  {hasCoords ? (
                    <>
                      <p className="admin-order-card__delivery-coords">
                        {order.lat?.toFixed(6)}, {order.lng?.toFixed(6)}
                      </p>
                      <div className="admin-order-card__delivery-links">
                        <a
                          className="admin-order-card__delivery-link"
                          href={`https://2gis.kg/geo/${order.lng},${order.lat}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          🗺 Открыть в 2GIS
                        </a>
                        <a
                          className="admin-order-card__delivery-link"
                          href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          🌍 Открыть в Google Maps
                        </a>
                      </div>
                      <button
                        type="button"
                        className="admin-order-card__delivery-copy"
                        onClick={async () => {
                          const text = `${String(order.lat)},${String(order.lng)}`;
                          try {
                            await navigator.clipboard.writeText(text);
                            alert("Скопировано");
                          } catch {
                            alert(text);
                          }
                        }}
                      >
                        📋 Скопировать координаты
                      </button>
                    </>
                  ) : null}
                </div>
                {hasReceipt && (
                  <div className="admin-order-card__receipt">
                    <p className="admin-order-card__receipt-title">Чек</p>
                    {(order.receiptType ?? "").toLowerCase() === "pdf" ? (
                      <a
                        className="admin-order-card__receipt-link"
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📄 Открыть PDF чек
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="admin-order-card__receipt-thumb-btn"
                        onClick={() =>
                          window.open(
                            receiptUrl,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <img
                          src={receiptUrl}
                          alt="Чек оплаты"
                          className="admin-order-card__receipt-thumb"
                        />
                      </button>
                    )}
                  </div>
                )}
                <div className="admin-order-card__tracking">
                  <label
                    className="admin-order-card__tracking-label"
                    htmlFor={`order-tracking-${order.id}`}
                  >
                    Статус доставки / комментарий
                  </label>
                  <textarea
                    id={`order-tracking-${order.id}`}
                    className="admin-order-card__tracking-input"
                    rows={2}
                    value={trackingDraft[order.id] ?? ""}
                    disabled={busy || busyTr}
                    placeholder="Например: Курьер выехал"
                    onChange={(e) => {
                      trackingDirtyRef.current.add(order.id);
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--tracking-save"
                    disabled={busy || busyTr}
                    onClick={() => void saveTracking(order.id)}
                  >
                    {busyTr ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
                <div className="admin-order-card__actions">
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--accept"
                    disabled={busy || canon !== "NEW"}
                    title={canon !== "NEW" ? "Только для статуса NEW" : undefined}
                    onClick={() => void applyStatus(order.id, "ACCEPTED")}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--confirm"
                    disabled={
                      busy ||
                      (!isFinik && canon !== "PAID_PENDING") ||
                      (isFinik && canon !== "ACCEPTED")
                    }
                    title={
                      isFinik
                        ? canon !== "ACCEPTED"
                          ? "Только для Finik после принятия заказа"
                          : undefined
                        : canon !== "PAID_PENDING"
                          ? "После «Я оплатил» у клиента"
                          : undefined
                    }
                    onClick={() => void applyStatus(order.id, "CONFIRMED")}
                  >
                    {isFinik
                      ? "💳 Подтвердить оплату (Finik)"
                      : "✅ Подтвердить оплату"}
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--reject"
                    disabled={busy || canon !== "PAID_PENDING"}
                    title={
                      canon !== "PAID_PENDING"
                        ? "Только для ожидания проверки оплаты"
                        : undefined
                    }
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Отклонить оплату и отменить заказ?"
                        )
                      ) {
                        return;
                      }
                      void applyStatus(order.id, "CANCELLED");
                    }}
                  >
                    ❌ Отклонить оплату
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--ship"
                    disabled={busy || canon !== "CONFIRMED"}
                    title={canon !== "CONFIRMED" ? "После подтверждения оплаты" : undefined}
                    onClick={() => void applyStatus(order.id, "SHIPPED")}
                  >
                    Отправлено
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
