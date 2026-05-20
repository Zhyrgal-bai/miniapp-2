import { useCallback, useEffect, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { apiAbsoluteUrl } from "../services/api";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { getWebAppUserId } from "../utils/telegramUserId";
import type { MyOrderRow } from "../types/myOrder";
import { orderDisplayLabel } from "@repo-shared/orderDisplay";
import { orderSupportPhase } from "@repo-shared/supportPhase";
import { returnReasonLabelRu } from "@repo-shared/supportLabels";
import {
  SF_ORDERS_INTENT_KEY,
  type OrdersListIntent,
} from "../utils/accountMenuStorage";
import {
  createReturnRequest,
  createSupportTicket,
  ensureGeneralSupportSession,
  fetchReturnRequestsForOrder,
  postSupportTicketMessage,
  uploadSupportPhoto,
  type ReturnReason,
  type SupportTicketRow,
  type SupportTicketType,
} from "../services/supportCustomerApi";
import { OrderTimeline } from "../components/support/OrderTimeline";
import { SupportChatMessages } from "../components/support/SupportChatMessages";
import { RETURN_STATUS_RU, mapStatus } from "../i18n/statusMaps";
import "../components/support/supportUi.css";
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
        <p className="my-orders__pay-info-title">💳 Оплата заказа {orderDisplayLabel(order)}</p>
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
  | { kind: "chat"; order: MyOrderRow }
  | { kind: "return"; order: MyOrderRow };

function OrderSupportChat({
  order,
  sessionTicket,
  busy,
  draft,
  onDraft,
  onSend,
  onAddPhoto,
}: {
  order: MyOrderRow;
  sessionTicket: SupportTicketRow | null;
  busy: boolean;
  draft: string;
  onDraft: (s: string) => void;
  onSend: () => void;
  onAddPhoto: () => void;
}) {
  const msgs = sessionTicket?.messages ?? [];
  return (
    <section className="my-orders__section my-orders__section--chat">
      <h2 className="my-orders__section-title">Чат с магазином</h2>
      {sessionTicket == null ? (
        <p className="my-orders__muted">Подключаем чат…</p>
      ) : (
        <>
          <SupportChatMessages messages={msgs} />
          <div className="my-orders__chat-composer">
            <button
              type="button"
              className="my-orders__scenario-btn my-orders__scenario-btn--ghost"
              disabled={busy}
              onClick={() => onAddPhoto()}
            >
              📎 Фото
            </button>
            <textarea
              className="my-orders__ticket-input"
              rows={2}
              placeholder="Напишите сообщение…"
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
        </>
      )}
      <p className="my-orders__muted my-orders__chat-order-ref">
        Заказ {orderDisplayLabel(order)}
      </p>
    </section>
  );
}

type MyOrdersProps = {
  profileIntentNonce?: number;
  profilePlainNonce?: number;
};

export default function MyOrders({
  profileIntentNonce = 0,
  profilePlainNonce = 0,
}: MyOrdersProps) {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [sessionTicket, setSessionTicket] = useState<SupportTicketRow | null>(null);
  const [returnsForOrder, setReturnsForOrder] = useState<
    Array<{ id: number; status: string; reason: string }>
  >([]);
  const [ticketDraft, setTicketDraft] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [returnReason, setReturnReason] = useState<ReturnReason>("OTHER");
  const [returnItemId, setReturnItemId] = useState<number | "">("");
  const [returnComment, setReturnComment] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [listIntentHint, setListIntentHint] = useState<OrdersListIntent | null>(
    null
  );

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

  useEffect(() => {
    const raw = sessionStorage.getItem(SF_ORDERS_INTENT_KEY);
    if (raw === "support" || raw === "returns") {
      setListIntentHint(raw);
      sessionStorage.removeItem(SF_ORDERS_INTENT_KEY);
    }
  }, [profileIntentNonce]);

  useEffect(() => {
    setListIntentHint(null);
  }, [profilePlainNonce]);

  useEffect(() => {
    if (screen.kind !== "list") setListIntentHint(null);
  }, [screen.kind]);

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
        const ret = await fetchReturnRequestsForOrder(userId, shopIdString, orderId);
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

  const loadSupportSession = useCallback(
    async (orderId: number) => {
      if (
        !Number.isFinite(userId) ||
        userId <= 0 ||
        shopIdString == null ||
        !/^\d+$/.test(shopIdString)
      ) {
        return;
      }
      setChatLoading(true);
      try {
        const session = await ensureGeneralSupportSession(userId, shopIdString, orderId);
        setSessionTicket(session);
      } catch (e) {
        console.error(e);
        setSessionTicket(null);
      } finally {
        setChatLoading(false);
      }
    },
    [userId, shopIdString]
  );

  useEffect(() => {
    if (screen.kind !== "order" && screen.kind !== "chat") return;
    void refreshOrderContext(screen.order.id);
  }, [screen, refreshOrderContext]);

  useEffect(() => {
    if (screen.kind !== "order" && screen.kind !== "chat") return;
    void loadSupportSession(screen.order.id);
  }, [screen, loadSupportSession]);

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
      setSessionTicket(t);
      setScreen({ kind: "chat", order });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSupportBusy(false);
    }
  }

  async function sendTicketMessage() {
    if (
      (screen.kind !== "chat" && screen.kind !== "order") ||
      !Number.isFinite(userId) ||
      userId <= 0 ||
      shopIdString == null ||
      !/^\d+$/.test(shopIdString) ||
      sessionTicket == null
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
        sessionTicket.id,
        text
      );
      setSessionTicket(t);
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
          } else if (sessionTicket != null) {
            const t = await postSupportTicketMessage(
              userId,
              shopIdString,
              sessionTicket.id,
              "Фото",
              [url]
            );
            setSessionTicket(t);
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
      await loadSupportSession(order.id);
      setScreen({ kind: "chat", order });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSupportBusy(false);
    }
  }

  const renderOrderDetail = (order: MyOrderRow) => {
    const phase = orderSupportPhase(order.status);
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
          <h1 className="my-orders__title">Заказ {orderDisplayLabel(order)}</h1>
          {dateLabel ? (
            <p className="my-orders__subtitle">{dateLabel}</p>
          ) : null}
        </header>

        <OrderTimeline status={order.status} />

        <div className="my-orders__status-row" aria-label="Текущий статус">
          <span className="my-orders__status-icon" aria-hidden>
            {statusVis.icon}
          </span>
          <span className="my-orders__status-label">{statusVis.label}</span>
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
                  Связаться с магазином
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
                  Где посылка?
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "DELIVERY")}
                >
                  Вопрос по доставке
                </button>
                <button
                  type="button"
                  className="my-orders__scenario-btn"
                  disabled={supportBusy}
                  onClick={() => void openScenario(order, "GENERAL")}
                >
                  Связаться с магазином
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
                  Возврат товара
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
                  Проблема с товаром
                </button>
              </>
            )}
            {order.status.toUpperCase() === "CANCELLED" && (
              <button
                type="button"
                className="my-orders__scenario-btn"
                disabled={supportBusy}
                onClick={() => void openScenario(order, "GENERAL")}
              >
                Задать вопрос
              </button>
            )}
          </div>
          <button
            type="button"
            className="my-orders__open-chat"
            disabled={supportBusy || chatLoading}
            onClick={() => setScreen({ kind: "chat", order })}
          >
            💬 Открыть чат
          </button>
        </section>

        {returnsForOrder.length > 0 && (
          <section className="my-orders__section">
            <h2 className="my-orders__section-title">Возвраты</h2>
            <ul className="my-orders__returns-list">
              {returnsForOrder.map((r) => (
                <li key={r.id}>
                  {returnReasonLabelRu(r.reason)} —{" "}
                  {mapStatus(r.status, RETURN_STATUS_RU)}
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

  if (screen.kind === "chat") {
    return (
      <div className="my-orders my-orders--detail">
        <button
          type="button"
          className="my-orders__back"
          onClick={() => setScreen({ kind: "order", order: screen.order })}
        >
          ← К заказу
        </button>
        <header className="my-orders__head">
          <h1 className="my-orders__title">
            Чат · {orderDisplayLabel(screen.order)}
          </h1>
        </header>
        <OrderSupportChat
          order={screen.order}
          sessionTicket={sessionTicket}
          busy={supportBusy}
          draft={ticketDraft}
          onDraft={setTicketDraft}
          onSend={() => void sendTicketMessage()}
          onAddPhoto={() => void pickSupportPhoto(screen.order.id)}
        />
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
        <h1 className="my-orders__title">Возврат · заказ {orderDisplayLabel(order)}</h1>
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
            <option value="SIZE">{returnReasonLabelRu("SIZE")}</option>
            <option value="DAMAGE">{returnReasonLabelRu("DAMAGE")}</option>
            <option value="WRONG_ITEM">{returnReasonLabelRu("WRONG_ITEM")}</option>
            <option value="QUALITY">{returnReasonLabelRu("QUALITY")}</option>
            <option value="OTHER">{returnReasonLabelRu("OTHER")}</option>
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

      {listIntentHint === "support" ? (
        <div className="my-orders__intent-banner" role="status">
          <strong className="my-orders__intent-banner-title">
            Поддержка
          </strong>
          <p className="my-orders__intent-banner-text">
            Откройте заказ ниже → «Подробнее и поддержка» — там сценарии и чат с
            магазином.
          </p>
        </div>
      ) : null}
      {listIntentHint === "returns" ? (
        <div
          className="my-orders__intent-banner my-orders__intent-banner--returns"
          role="status"
        >
          <strong className="my-orders__intent-banner-title">Возвраты</strong>
          <p className="my-orders__intent-banner-text">
            Выберите доставленный заказ → «Подробнее» → раздел «Возврат»
            (после статуса «Доставлен»).
          </p>
        </div>
      ) : null}

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
          const statusVis = orderStatusVisual(order.status);
          const dateLabel = formatOrderDate(order.createdAt);
          return (
            <article key={order.id} className="my-orders__card">
              <div className="my-orders__card-head">
                <h3 className="my-orders__card-title">Заказ {orderDisplayLabel(order)}</h3>
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
