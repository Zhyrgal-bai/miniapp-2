import { useCallback, useEffect, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { apiAbsoluteUrl } from "../services/api";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { getWebAppUserId } from "../utils/telegramUserId";
import type { MyOrderRow } from "../types/myOrder";
import { orderSupportPhase } from "@repo-shared/supportPhase";
import {
  createReturnRequest,
  createSupportTicket,
  fetchMyOrderDetail,
  fetchReturnRequestsForOrder,
  fetchSupportTicket,
  fetchSupportTicketsForOrder,
  postSupportTicketMessage,
  uploadSupportPhoto,
  type ReturnReason,
  type SupportTicketRow,
  type SupportTicketType,
} from "../services/supportCustomerApi";
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
    DELIVERED: { icon: "✅", label: "Доставлен" },
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
    SHIPPED: 90,
    DELIVERED: 100,
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
    if (
      st === "CANCELLED" ||
      st === "CONFIRMED" ||
      st === "SHIPPED" ||
      st === "DELIVERED"
    ) {
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

  if (
    st === "CANCELLED" ||
    st === "CONFIRMED" ||
    st === "SHIPPED" ||
    st === "DELIVERED"
  ) {
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

type Screen =
  | { kind: "list" }
  | { kind: "order"; order: MyOrderRow }
  | { kind: "ticket"; orderId: number; ticketId: number }
  | { kind: "return"; order: MyOrderRow };

function TicketThreadView({
  ticket,
  busy,
  draft,
  onDraft,
  onSend,
  onAddPhoto,
}: {
  ticket: SupportTicketRow;
  busy: boolean;
  draft: string;
  onDraft: (s: string) => void;
  onSend: () => void;
  onAddPhoto: () => void;
}) {
  const msgs = Array.isArray(ticket.messages) ? ticket.messages : [];
  return (
    <div className="my-orders__ticket">
      <ul className="my-orders__ticket-msgs">
        {msgs.map((m, i) => (
          <li key={m.id ?? i} className="my-orders__ticket-msg">
            <span className="my-orders__ticket-sender">{m.senderType}</span>
            <p className="my-orders__ticket-text">{m.text}</p>
          </li>
        ))}
      </ul>
      <div className="my-orders__ticket-actions">
        <button
          type="button"
          className="my-orders__scenario-btn"
          disabled={busy}
          onClick={() => onAddPhoto()}
        >
          📎 Фото
        </button>
      </div>
      <textarea
        className="my-orders__ticket-input"
        rows={3}
        placeholder="Уточнение для поддержки…"
        value={draft}
        disabled={busy}
        onChange={(e) => onDraft(e.target.value)}
      />
      <button
        type="button"
        className="my-orders__scenario-btn"
        disabled={busy || !draft.trim()}
        onClick={() => onSend()}
      >
        Отправить
      </button>
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [ticketRow, setTicketRow] = useState<SupportTicketRow | null>(null);
  const [ticketsForOrder, setTicketsForOrder] = useState<SupportTicketRow[]>([]);
  const [returnsForOrder, setReturnsForOrder] = useState<
    Array<{ id: number; status: string; reason: string }>
  >([]);
  const [ticketDraft, setTicketDraft] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);

  const [returnReason, setReturnReason] = useState<ReturnReason>("OTHER");
  const [returnItemId, setReturnItemId] = useState<number | "">("");
  const [returnComment, setReturnComment] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);

  const { shopIdString, businessId } = useShop();
  const { payload } = useStorefrontPayload();
  const userId = getWebAppUserId();

  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setOrders([]);
      setError("Откройте раздел в Telegram");
      setLoading(false);
      return;
    }
    if (shopIdString == null || businessId == null) {
      setOrders([]);
      setSettings(null);
      setError("Магазин не найден");
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyOrders(userId, shopIdString);
      const settingsUrl = new URL(apiAbsoluteUrl("/settings"));
      settingsUrl.searchParams.set("userId", String(userId));
      settingsUrl.searchParams.set("shop", shopIdString);
      settingsUrl.searchParams.set("businessId", shopIdString);
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
  }, [userId, shopIdString, businessId]);

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

  const refreshOrderContext = useCallback(
    async (orderId: number) => {
      if (
        !Number.isFinite(userId) ||
        userId <= 0 ||
        shopIdString == null ||
        !/^\d+$/.test(shopIdString)
      ) {
        return;
      }
      try {
        const [tix, ret] = await Promise.all([
          fetchSupportTicketsForOrder(userId, shopIdString, orderId),
          fetchReturnRequestsForOrder(userId, shopIdString, orderId),
        ]);
        setTicketsForOrder(tix);
        setReturnsForOrder(
          ret.map((r) => ({
            id: r.id,
            status: r.status,
            reason: r.reason,
          }))
        );
      } catch (e) {
        console.error(e);
      }
    },
    [userId, shopIdString]
  );

  useEffect(() => {
    if (screen.kind !== "order") return;
    void refreshOrderContext(screen.order.id);
  }, [screen, refreshOrderContext]);

  useEffect(() => {
    if (screen.kind !== "ticket") return;
    let cancelled = false;
    void (async () => {
      if (
        !Number.isFinite(userId) ||
        userId <= 0 ||
        shopIdString == null ||
        !/^\d+$/.test(shopIdString)
      ) {
        return;
      }
      try {
        const t = await fetchSupportTicket(
          userId,
          shopIdString,
          screen.ticketId
        );
        if (!cancelled) setTicketRow(t);
      } catch (e) {
        console.error(e);
        if (!cancelled) setTicketRow(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, userId, shopIdString]);

  async function openScenario(order: MyOrderRow, type: SupportTicketType) {
    if (
      !Number.isFinite(userId) ||
      userId <= 0 ||
      shopIdString == null ||
      !/^\d+$/.test(shopIdString)
    ) {
      return;
    }
    setSupportBusy(true);
    try {
      const t = await createSupportTicket(userId, shopIdString, {
        orderId: order.id,
        type,
      });
      setScreen({ kind: "ticket", orderId: order.id, ticketId: t.id });
      await refreshOrderContext(order.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось создать обращение");
    } finally {
      setSupportBusy(false);
    }
  }

  async function sendTicketMessage() {
    if (
      screen.kind !== "ticket" ||
      !Number.isFinite(userId) ||
      userId <= 0 ||
      shopIdString == null ||
      !/^\d+$/.test(shopIdString)
    ) {
      return;
    }
    const text = ticketDraft.trim();
    if (!text) return;
    setSupportBusy(true);
    try {
      const t = await postSupportTicketMessage(
        userId,
        shopIdString,
        screen.ticketId,
        text
      );
      setTicketRow(t);
      setTicketDraft("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSupportBusy(false);
    }
  }

  async function pickSupportPhoto(orderId: number) {
    if (
      !Number.isFinite(userId) ||
      userId <= 0 ||
      shopIdString == null ||
      !/^\d+$/.test(shopIdString)
    ) {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        setSupportBusy(true);
        try {
          const { url } = await uploadSupportPhoto(
            userId,
            shopIdString,
            orderId,
            file
          );
          if (screen.kind === "return") {
            setReturnPhotos((p) => [...p, url].slice(0, 8));
          } else if (screen.kind === "ticket") {
            await postSupportTicketMessage(
              userId,
              shopIdString,
              screen.ticketId,
              "Фото",
              [url]
            );
            const t = await fetchSupportTicket(
              userId,
              shopIdString,
              screen.ticketId
            );
            setTicketRow(t);
          }
        } catch (e) {
          alert(e instanceof Error ? e.message : "Загрузка не удалась");
        } finally {
          setSupportBusy(false);
        }
      })();
    };
    input.click();
  }

  async function submitReturn(order: MyOrderRow) {
    if (
      !Number.isFinite(userId) ||
      userId <= 0 ||
      shopIdString == null ||
      !/^\d+$/.test(shopIdString)
    ) {
      return;
    }
    setSupportBusy(true);
    try {
      await createReturnRequest(userId, shopIdString, {
        orderId: order.id,
        orderItemId: returnItemId === "" ? null : returnItemId,
        reason: returnReason,
        comment: returnComment.trim() || undefined,
        photos: returnPhotos,
      });
      alert("Заявка отправлена");
      setReturnPhotos([]);
      setReturnComment("");
      await refreshOrderContext(order.id);
      setScreen({ kind: "order", order });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSupportBusy(false);
    }
  }

  const renderOrderDetail = (order: MyOrderRow) => {
    const phase = orderSupportPhase(order.status);
    const pct = orderStatusProgress(order.status);
    const statusVis = orderStatusVisual(order.status);
    const dateLabel = formatOrderDate(order.createdAt);

    return (
      <div className="my-orders my-orders--detail">
        <button
          type="button"
          className="my-orders__back"
          onClick={() => setScreen({ kind: "list" })}
        >
          ← К списку
        </button>
        <header className="my-orders__head">
          <h1 className="my-orders__title">Заказ #{order.id}</h1>
          {dateLabel ? (
            <p className="my-orders__subtitle">{dateLabel}</p>
          ) : null}
        </header>

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

        {order.items != null && order.items.length > 0 && (
          <ul className="my-orders__items">
            {order.items.map((it) => (
              <li key={it.id}>
                {it.name} · {it.color} / {it.size} × {it.quantity}
              </li>
            ))}
          </ul>
        )}

        <OrderPaymentBlock order={order} settings={settings} />
        <OrderReceiptBlock order={order} userId={userId} onUploaded={load} />

        <section className="my-orders__section">
          <h2 className="my-orders__section-title">Чем помочь?</h2>
          <div className="my-orders__scenario-grid">
            {phase === "PROCESSING" && (
              <>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "CANCEL_REQUEST")}
                >
                  Отменить заказ
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "ADDRESS_CHANGE")}
                >
                  Изменить адрес
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "GENERAL")}
                >
                  Связаться с поддержкой
                </button>
              </>
            )}
            {phase === "SHIPPING" && (
              <>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "TRACKING")}
                >
                  Вопрос по треку
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "DELIVERY")}
                >
                  Проблема с доставкой
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "GENERAL")}
                >
                  Поддержка
                </button>
              </>
            )}
            {phase === "DELIVERED" && (
              <>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => {
                    setReturnItemId("");
                    setReturnReason("OTHER");
                    setReturnPhotos([]);
                    setScreen({ kind: "return", order });
                  }}
                >
                  Возврат
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "EXCHANGE")}
                >
                  Обмен
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "QUALITY")}
                >
                  Качество / повреждение
                </button>
              </>
            )}
            {order.status.toUpperCase() === "CANCELLED" && (
              <p className="my-orders__muted">Заказ отменён</p>
            )}
          </div>
        </section>

        {ticketsForOrder.length > 0 && (
          <section className="my-orders__section">
            <h2 className="my-orders__section-title">Обращения</h2>
            <ul className="my-orders__ticket-list">
              {ticketsForOrder.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="my-orders__linkish"
                    onClick={() =>
                      setScreen({
                        kind: "ticket",
                        orderId: order.id,
                        ticketId: t.id,
                      })
                    }
                  >
                    Тикет #{t.id} · {t.status} · {t.type}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {returnsForOrder.length > 0 && (
          <section className="my-orders__section">
            <h2 className="my-orders__section-title">Возвраты</h2>
            <ul className="my-orders__items">
              {returnsForOrder.map((r) => (
                <li key={r.id}>
                  #{r.id} — {r.reason}: {r.status}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  };

  if (screen.kind === "order") {
    return renderOrderDetail(screen.order);
  }

  if (screen.kind === "ticket") {
    return (
      <div className="my-orders my-orders--detail">
        <button
          type="button"
          className="my-orders__back"
          onClick={() => {
            setTicketRow(null);
            void (async () => {
              if (
                shopIdString &&
                /^\d+$/.test(shopIdString) &&
                Number.isFinite(userId)
              ) {
                try {
                  const fresh = await fetchMyOrderDetail(
                    userId,
                    shopIdString,
                    screen.orderId
                  );
                  setScreen({ kind: "order", order: fresh });
                } catch {
                  const fallback = orders.find((o) => o.id === screen.orderId);
                  if (fallback) setScreen({ kind: "order", order: fallback });
                  else setScreen({ kind: "list" });
                }
              } else {
                setScreen({ kind: "list" });
              }
            })();
          }}
        >
          ← К заказу
        </button>
        <h1 className="my-orders__title">Обращение #{screen.ticketId}</h1>
        {!ticketRow && <p className="my-orders__muted">Загрузка…</p>}
        {ticketRow && (
          <TicketThreadView
            ticket={ticketRow}
            busy={supportBusy}
            draft={ticketDraft}
            onDraft={setTicketDraft}
            onSend={() => void sendTicketMessage()}
            onAddPhoto={() => void pickSupportPhoto(screen.orderId)}
          />
        )}
      </div>
    );
  }

  if (screen.kind === "return") {
    const order = screen.order;
    return (
      <div className="my-orders my-orders--detail">
        <button
          type="button"
          className="my-orders__back"
          onClick={() => setScreen({ kind: "order", order })}
        >
          ← Назад
        </button>
        <h1 className="my-orders__title">Возврат · заказ #{order.id}</h1>
        <p className="my-orders__muted">
          Доступно после доставки. Укажите позицию (необязательно), причину и
          фото.
        </p>
        <label className="my-orders__field">
          <span>Позиция</span>
          <select
            className="my-orders__select"
            value={returnItemId === "" ? "" : String(returnItemId)}
            disabled={supportBusy}
            onChange={(e) => {
              const v = e.target.value;
              setReturnItemId(v === "" ? "" : Number(v));
            }}
          >
            <option value="">Весь заказ</option>
            {(order.items ?? []).map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} × {it.quantity}
              </option>
            ))}
          </select>
        </label>
        <label className="my-orders__field">
          <span>Причина</span>
          <select
            className="my-orders__select"
            value={returnReason}
            disabled={supportBusy}
            onChange={(e) =>
              setReturnReason(e.target.value as ReturnReason)
            }
          >
            <option value="SIZE">Размер</option>
            <option value="DAMAGE">Повреждение</option>
            <option value="WRONG_ITEM">Неверный товар</option>
            <option value="QUALITY">Качество</option>
            <option value="OTHER">Другое</option>
          </select>
        </label>
        <label className="my-orders__field">
          <span>Комментарий</span>
          <textarea
            className="my-orders__ticket-input"
            rows={3}
            value={returnComment}
            disabled={supportBusy}
            onChange={(e) => setReturnComment(e.target.value)}
          />
        </label>
        <p className="my-orders__muted">Фото: {returnPhotos.length} шт.</p>
        <div className="my-orders__scenario-grid">
          <button
            type="button"
            className="my-orders__scenario-btn"
            disabled={supportBusy}
            onClick={() => void pickSupportPhoto(order.id)}
          >
            Добавить фото
          </button>
          <button
            type="button"
            className="my-orders__scenario-btn"
            disabled={supportBusy}
            onClick={() => void submitReturn(order)}
          >
            Отправить заявку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-orders">
      <header className="my-orders__head">
        <h1 className="my-orders__title">{readTxt("menuOrdersLabel", "Мои заказы")}</h1>
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
          <p className="my-orders__empty-title">
            {readTxt("emptyOrdersTitle", "У вас пока нет заказов 😔")}
          </p>
          <p className="my-orders__empty-hint">
            {readTxt("emptyOrdersHint", "Заказы появятся здесь после оформления")}
          </p>
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
              <button
                type="button"
                className="my-orders__open-order"
                onClick={() => setScreen({ kind: "order", order })}
              >
                Подробнее и поддержка
              </button>
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
