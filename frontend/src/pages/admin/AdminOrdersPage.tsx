import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminService,
  type AdminOrderListItem,
} from "../../services/admin.service";
import { orderDisplayLabel } from "@repo-shared/orderDisplay";
import {
  finikOrderIsAwaitingPayment,
  finikPaymentStateView,
  isFinikPaymentMethod,
} from "@repo-shared/finikPaymentState";

const FILTER_TABS = [
  "ALL",
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
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
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busySyncId, setBusySyncId] = useState<number | null>(null);
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
    const list = filter === "ALL" ? orders : orders.filter((o) => canonicalStatus(o.status) === filter);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const digits = q.replace(/\D/g, "");
    return list.filter((o) => {
      const label = orderDisplayLabel(o).toLowerCase();
      const num = (o.orderNumber ?? "").toLowerCase();
      const phone = o.phone.replace(/\D/g, "");
      return (
        label.includes(q) ||
        num.includes(q) ||
        String(o.id).includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (digits.length >= 3 && phone.includes(digits))
      );
    });
  }, [orders, filter, search]);

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
    status:
      | "ACCEPTED"
      | "CONFIRMED"
      | "SHIPPED"
      | "DELIVERED"
      | "CANCELLED"
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

  async function syncFinikPayment(id: number) {
    setBusySyncId(id);
    try {
      const result = await adminService.syncFinikPayment(id);
      if (result.paymentState === "paid") {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("miniapp:admin-orders-changed"));
        alert(
          result.duplicate
            ? "Оплата уже была подтверждена автоматически."
            : "Оплата подтверждена через Finik."
        );
      } else if (result.paymentState === "pending") {
        alert("Оплата ещё не поступила. Попросите клиента завершить оплату или проверьте позже.");
      } else {
        alert("Finik сообщил об ошибке или отмене оплаты.");
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Не удалось проверить оплату");
    } finally {
      setBusySyncId(null);
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
          Управление заказами только в Mini App. Список обновляется каждые 3 с.
        </p>
      </header>

      <div className="admin-order-search">
        <input
          type="search"
          className="admin-order-search__input"
          placeholder="Поиск: номер, телефон, имя"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Поиск заказов"
        />
      </div>

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
            {tab === "ALL" ? "Все" : ORDER_STATUS_LABEL_RU[tab] ?? tab}
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
            const isFinik = isFinikPaymentMethod(order.paymentMethod);
            const finikPay = isFinik
              ? finikPaymentStateView({
                  orderStatus: order.status,
                  paymentMethod: order.paymentMethod,
                })
              : null;
            const finikAwaiting = isFinik && finikOrderIsAwaitingPayment(order.status);
            const busySync = busySyncId === order.id;
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
                <div className="admin-order-card__identity">
                  <h2 className="admin-order-card__client">{order.name}</h2>
                  <p className="admin-order-card__subline">
                    Заказ {order.displayNumber ?? orderDisplayLabel(order)}
                    {order.buyerTelegramId ? (
                      <>
                        {" · "}
                        <a
                          href={`tg://user?id=${order.buyerTelegramId}`}
                          className="admin-order-card__tg-link"
                        >
                          Написать в Telegram
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <dl className="admin-order-card__dl">
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
                      {isFinik ? (
                        <>
                          Finik
                          {finikPay ? (
                            <span className="admin-order-card__finik-pay">
                              {" · "}
                              {finikPay.label}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "Чек / перевод"
                      )}
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
                  {!isFinik ? (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--accept"
                      disabled={busy || canon !== "NEW"}
                      title={canon !== "NEW" ? "Только для статуса NEW" : undefined}
                      onClick={() => void applyStatus(order.id, "ACCEPTED")}
                    >
                      Принять
                    </button>
                  ) : null}
                  {!isFinik ? (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--confirm"
                      disabled={busy || canon !== "PAID_PENDING"}
                      title={
                        canon !== "PAID_PENDING"
                          ? "После «Я оплатил» у клиента"
                          : undefined
                      }
                      onClick={() => void applyStatus(order.id, "CONFIRMED")}
                    >
                      ✅ Подтвердить оплату
                    </button>
                  ) : null}
                  {isFinik && finikAwaiting ? (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--confirm"
                      disabled={busy || busySync}
                      title="Запросить статус у Finik (не ручное подтверждение)"
                      onClick={() => void syncFinikPayment(order.id)}
                    >
                      {busySync ? "Проверка…" : "🔄 Проверить статус оплаты"}
                    </button>
                  ) : null}
                  {!isFinik ? (
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
                  ) : null}
                  {isFinik && finikAwaiting ? (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--reject"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Отменить неоплаченный заказ?")) {
                          return;
                        }
                        void applyStatus(order.id, "CANCELLED");
                      }}
                    >
                      Отменить заказ
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--ship"
                    disabled={busy || canon !== "CONFIRMED"}
                    title={canon !== "CONFIRMED" ? "После подтверждения оплаты" : undefined}
                    onClick={() => void applyStatus(order.id, "SHIPPED")}
                  >
                    Отправлено
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--confirm"
                    disabled={busy || canon !== "SHIPPED"}
                    title={
                      canon !== "SHIPPED"
                        ? "Сначала отметьте отправку"
                        : "Клиент сможет оформить возврат"
                    }
                    onClick={() => void applyStatus(order.id, "DELIVERED")}
                  >
                    Доставлено
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
