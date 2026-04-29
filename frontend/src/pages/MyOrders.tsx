import { useCallback, useEffect, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { apiAbsoluteUrl } from "../services/api";
import { getWebAppUserId } from "../utils/telegramUserId";
import { getActiveShopId } from "../utils/storeParams";
import type { MyOrderRow } from "../types/myOrder";
import "./MyOrders.css";

export type { MyOrderRow };

type GlobalSettings = {
  mbank?: string | null;
  optima?: string | null;
  other?: string | null;
  card?: string | null;
  qr?: string | null;
};

function orderStatusVisual(status: string): { icon: string; label: string } {
  const u = status.toUpperCase();
  const map: Record<string, { icon: string; label: string }> = {
    NEW: { icon: "🆕", label: "Новый" },
    ACCEPTED: { icon: "✅", label: "Принят" },
    PAID_PENDING: { icon: "💰", label: "Проверка оплаты" },
    CONFIRMED: { icon: "📦", label: "Готовится" },
    SHIPPED: { icon: "🚚", label: "В пути" },
    CANCELLED: { icon: "❌", label: "Отменён" },
  };
  return map[u] ?? { icon: "•", label: status };
}

function orderStatusProgress(status: string): number {
  const u = status.toUpperCase();
  const map: Record<string, number> = {
    NEW: 10,
    ACCEPTED: 30,
    PAID_PENDING: 60,
    CONFIRMED: 80,
    SHIPPED: 100,
  };
  return map[u] ?? 0;
}

function formatOrderDate(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isFinikOrder(order: MyOrderRow): boolean {
  return String(order.paymentMethod ?? "").toLowerCase() === "finik";
}

function OrderReceiptBlock({
  order,
  userId,
  onUploaded,
}: {
  order: MyOrderRow;
  userId: number;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const st = order.status.toUpperCase();
  const hasReceipt = Boolean(order.receiptUrl?.trim());

  if (isFinikOrder(order)) {
    if (st === "CANCELLED" || st === "CONFIRMED" || st === "SHIPPED") {
      return null;
    }
    return (
      <div className="my-orders__finik-wait" aria-live="polite">
        <p className="my-orders__finik-wait-lead">Проверяем оплату...</p>
        <p className="my-orders__finik-wait-sub">
          После оплаты через Finik статус обновится автоматически (около минуты).
          Список заказов обновляется каждые 5 с.
        </p>
      </div>
    );
  }

  if (st === "CANCELLED" || st === "CONFIRMED" || st === "SHIPPED") {
    return null;
  }

  if (st === "PAID_PENDING") {
    return (
      <div className="my-orders__receipt-pending" aria-live="polite">
        <p className="my-orders__receipt-pending-lead">Чек отправлен ✅</p>
        <p className="my-orders__receipt-pending-sub">Ожидайте проверки</p>
      </div>
    );
  }

  if (st !== "ACCEPTED") {
    return null;
  }

  if (hasReceipt) {
    return (
      <div className="my-orders__receipt-pending" aria-live="polite">
        <p className="my-orders__receipt-pending-lead">Чек отправлен ✅</p>
        <p className="my-orders__receipt-pending-sub">Ожидайте проверки</p>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!file) {
      alert("Загрузите чек");
      return;
    }
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("userId", String(userId));
    try {
      const res = await fetch(apiAbsoluteUrl(`/orders/${order.id}/upload-receipt`), {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg =
          typeof data.error === "string" && data.error
            ? data.error
            : "Ошибка загрузки";
        alert(msg);
        return;
      }
      alert("Чек отправлен ✅");
      setFile(null);
      setInputKey((k) => k + 1);
      await onUploaded();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-orders__receipt">
      <p className="my-orders__receipt-timer">Оплатите в течение 30 минут</p>
      <label className="my-orders__receipt-label" htmlFor={`receipt-${order.id}`}>
        Чек оплаты (фото или PDF)
      </label>
      <input
        key={inputKey}
        id={`receipt-${order.id}`}
        type="file"
        accept="image/*,.pdf"
        className="my-orders__receipt-input"
        disabled={loading}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="my-orders__receipt-btn"
        disabled={loading || !file}
        onClick={() => void handleUpload()}
      >
        {loading ? "Загрузка..." : "💰 Я оплатил"}
      </button>
    </div>
  );
}

function OrderPaymentBlock({
  order,
  settings,
}: {
  order: MyOrderRow;
  settings: GlobalSettings | null;
}) {
  const st = order.status.toUpperCase();
  const hasReceipt = Boolean(order.receiptUrl?.trim());
  if (isFinikOrder(order)) return null;
  if (st !== "ACCEPTED" || hasReceipt) return null;

  const phone = settings?.mbank?.trim() || "";
  const optima = settings?.optima?.trim() || "";
  const otherBank = settings?.other?.trim() || "";
  const card = settings?.card?.trim() || "";
  const qr = settings?.qr?.trim() || "";

  const copyPhone = async () => {
    const target = phone || optima || card || otherBank;
    if (!target) {
      alert("Реквизиты пока не заполнены");
      return;
    }
    try {
      await navigator.clipboard.writeText(target);
      alert("Реквизиты скопированы");
    } catch {
      alert(target);
    }
  };

  return (
    <div className="my-orders__pay-block">
      <p className="my-orders__pay-ux">Сканируйте QR или оплатите по номеру</p>
      {qr ? (
        <img
          className="my-orders__pay-qr-img my-orders__pay-qr-img--lg"
          src={qr}
          alt={`QR оплаты заказа #${order.id}`}
          width={250}
          height={250}
        />
      ) : null}
      <div className="my-orders__pay-info">
        <p className="my-orders__pay-info-title">💳 Оплата заказа #{order.id}</p>
        <p className="my-orders__pay-info-sum">{order.total} сом</p>
        {phone ? <p className="my-orders__pay-info-phone">MBank: {phone}</p> : null}
        {optima ? <p className="my-orders__pay-info-phone">Optima: {optima}</p> : null}
        {otherBank ? (
          <p className="my-orders__pay-info-phone">Банк: {otherBank}</p>
        ) : null}
        {card ? <p className="my-orders__pay-info-phone">Карта: {card}</p> : null}
      </div>
      <button
        type="button"
        className="my-orders__pay-copy-btn"
        onClick={() => void copyPhone()}
      >
        📋 Скопировать MBank
      </button>
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = getWebAppUserId();

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setOrders([]);
      setError("Откройте раздел в Telegram");
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyOrders(userId);
      const shop =
        getActiveShopId() ||
        (data[0]?.ownerId != null ? String(data[0].ownerId) : null);
      const settingsUrl = new URL(apiAbsoluteUrl("/settings"));
      settingsUrl.searchParams.set("userId", String(userId));
      if (shop) settingsUrl.searchParams.set("shop", shop);
      const settingsRes = await fetch(settingsUrl.toString(), { method: "GET" });
      const settingsData = (await settingsRes
        .json()
        .catch(() => ({}))) as GlobalSettings;
      setOrders(data);
      setSettings(settingsData);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="my-orders">
      <header className="my-orders__head">
        <h1 className="my-orders__title">Мои заказы</h1>
        <p className="my-orders__subtitle">Автообновление каждые 5 с</p>
      </header>

      {loading && <p className="my-orders__muted">Загрузка...</p>}
      {error && (
        <p className="my-orders__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="my-orders__empty" role="status">
          <p className="my-orders__empty-title">У вас пока нет заказов 😔</p>
          <p className="my-orders__empty-hint">Заказы появятся здесь после оформления</p>
        </div>
      )}

      <div className="my-orders__list">
        {orders.map((order) => {
          const pct = orderStatusProgress(order.status);
          const statusVis = orderStatusVisual(order.status);
          const dateLabel = formatOrderDate(order.createdAt);
          return (
            <article key={order.id} className="my-orders__card">
              <div className="my-orders__card-head">
                <h3 className="my-orders__card-title">Заказ #{order.id}</h3>
                {dateLabel ? (
                  <time className="my-orders__date" dateTime={order.createdAt}>
                    {dateLabel}
                  </time>
                ) : null}
              </div>

              <div className="my-orders__status-row" aria-label="Статус заказа">
                <span className="my-orders__status-icon" aria-hidden>
                  {statusVis.icon}
                </span>
                <span className="my-orders__status-label">{statusVis.label}</span>
              </div>

              <div
                className="my-orders__progress-wrap"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Прогресс заказа"
              >
                <div className="my-orders__progress-track">
                  <div
                    className="my-orders__progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <p className="my-orders__total-line">
                <span className="my-orders__label">Сумма</span>
                <span className="my-orders__total-value">{order.total} сом</span>
              </p>

              {order.tracking != null && order.tracking.trim() !== "" && (
                <p className="my-orders__tracking">📍 {order.tracking}</p>
              )}
              <OrderPaymentBlock order={order} settings={settings} />
              <OrderReceiptBlock order={order} userId={userId} onUploaded={load} />
              {order.items != null && order.items.length > 0 && (
                <ul className="my-orders__items">
                  {order.items.map((it) => (
                    <li key={it.id}>
                      {it.name} · {it.color} / {it.size} × {it.quantity}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
