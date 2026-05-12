import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { getWebAppUserId } from "../utils/telegramUserId";
import type { MyOrderRow } from "../types/myOrder";
import { orderSupportPhase, type SupportPhase } from "@repo-shared/supportPhase";
import {
  createReturnRequest,
  createSupportTicket,
  ensureGeneralSupportSession,
  fetchSupportTicket,
  fetchSupportTicketsForOrder,
  postSupportTicketMessage,
  uploadSupportPhoto,
  type ReturnReason,
  type SupportTicketRow,
  type SupportTicketType,
} from "../services/supportCustomerApi";
import "./SupportHubPage.css";

type HubScreen = { kind: "chat" } | { kind: "return"; order: MyOrderRow };

type QuickChip =
  | { key: string; label: string; kind: "ticket"; ticketType: SupportTicketType }
  | { key: string; label: string; kind: "return" }
  | { key: string; label: string; kind: "draft"; text: string };

function phaseLabelRu(phase: SupportPhase): string {
  switch (phase) {
    case "PROCESSING":
      return "В обработке";
    case "SHIPPING":
      return "В пути";
    case "DELIVERED":
      return "Доставлен";
    case "CANCELLED":
      return "Отменён";
    default:
      return phase;
  }
}

function quickChipsForOrder(order: MyOrderRow): QuickChip[] {
  const phase = orderSupportPhase(order.status);
  switch (phase) {
    case "PROCESSING":
      return [
        { key: "cancel", label: "Отмена", kind: "ticket", ticketType: "CANCEL_REQUEST" },
        { key: "ex", label: "Обмен", kind: "ticket", ticketType: "EXCHANGE" },
        { key: "q", label: "Проблема", kind: "ticket", ticketType: "QUALITY" },
        { key: "tr", label: "Где посылка", kind: "ticket", ticketType: "TRACKING" },
      ];
    case "SHIPPING":
      return [
        { key: "tr", label: "Трекинг", kind: "ticket", ticketType: "TRACKING" },
        { key: "del", label: "Доставка", kind: "ticket", ticketType: "DELIVERY" },
        { key: "ret", label: "Возврат", kind: "ticket", ticketType: "RETURN" },
        { key: "q", label: "Проблема", kind: "ticket", ticketType: "QUALITY" },
      ];
    case "DELIVERED":
      return [
        { key: "retf", label: "Возврат", kind: "return" },
        { key: "ex", label: "Обмен", kind: "ticket", ticketType: "EXCHANGE" },
        { key: "q", label: "Проблема", kind: "ticket", ticketType: "QUALITY" },
      ];
    case "CANCELLED":
      return [
        {
          key: "ask",
          label: "Вопрос по отмене",
          kind: "draft",
          text: `Вопрос по отменённому заказу №${order.id}`,
        },
      ];
    default:
      return [];
  }
}

function OrderContextCard({ order }: { order: MyOrderRow }) {
  const phase = orderSupportPhase(order.status);
  const items = order.items ?? [];
  const thumbs = items.slice(0, 4);
  const n = items.reduce((s, it) => s + it.quantity, 0);
  return (
    <div className="sf-support-order-card" role="group" aria-label="Заказ">
      <div className="sf-support-order-card__status">{phaseLabelRu(phase)}</div>
      <div className="sf-support-order-card__row">
        <span className="sf-support-order-card__price">{order.total} сом</span>
        <span className="sf-support-order-card__count">
          {n} {n === 1 ? "товар" : "тов."}
        </span>
      </div>
      {thumbs.length > 0 ? (
        <div className="sf-support-order-card__thumbs">
          {thumbs.map((it) => (
            <div
              key={it.id}
              className="sf-support-order-card__thumb"
              title={it.name}
            >
              <span className="sf-support-order-card__thumb-fallback" aria-hidden>
                {it.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="sf-support-order-card__id">Заказ №{order.id}</div>
    </div>
  );
}

function MessageList({
  messages,
}: {
  messages: NonNullable<SupportTicketRow["messages"]>;
}) {
  return (
    <ul className="sf-support-msgs" aria-live="polite">
      {messages.map((m, i) => {
        const st = String(m.senderType ?? "").toUpperCase();
        const isMine = st === "CUSTOMER";
        const isSystem = st === "SYSTEM";
        return (
          <li
            key={m.id ?? `m-${i}`}
            className={`sf-support-msg${isMine ? " sf-support-msg--mine" : ""}${isSystem ? " sf-support-msg--system" : ""}`}
          >
            {!isMine ? (
              <span className="sf-support-msg__who">
                {isSystem ? "Поддержка" : st === "MERCHANT" ? "Магазин" : st}
              </span>
            ) : null}
            <p className="sf-support-msg__text">{m.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

type SupportHubPageProps = {
  onBack: () => void;
  onGoShopping?: () => void;
};

export default function SupportHubPage({
  onBack,
  onGoShopping,
}: SupportHubPageProps) {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [screen, setScreen] = useState<HubScreen>({ kind: "chat" });
  const [generalTicket, setGeneralTicket] = useState<SupportTicketRow | null>(null);
  const [topicTicket, setTopicTicket] = useState<SupportTicketRow | null>(null);
  const [ticketsForOrder, setTicketsForOrder] = useState<SupportTicketRow[]>([]);
  const [ticketDraft, setTicketDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const [returnReason, setReturnReason] = useState<ReturnReason>("OTHER");
  const [returnItemId, setReturnItemId] = useState<number | "">("");
  const [returnComment, setReturnComment] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);

  const endRef = useRef<HTMLDivElement>(null);

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
      setError("Откройте приложение в Telegram");
      setLoading(false);
      return;
    }
    if (shopIdString == null || businessId == null) {
      setOrders([]);
      setError("Магазин не найден");
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyOrders(userId, shopIdString);
      setOrders(data);
      setError(null);
      setSelectedId((prev) => {
        if (prev != null && data.some((o) => o.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId, shopIdString, businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId]
  );

  const refreshSessionAndTickets = useCallback(
    async (orderId: number) => {
      if (
        !Number.isFinite(userId) ||
        userId <= 0 ||
        shopIdString == null ||
        !/^\d+$/.test(shopIdString)
      ) {
        return;
      }
      setSessionLoading(true);
      try {
        const [session, tix] = await Promise.all([
          ensureGeneralSupportSession(userId, shopIdString, orderId),
          fetchSupportTicketsForOrder(userId, shopIdString, orderId),
        ]);
        setGeneralTicket(session);
        setTicketsForOrder(tix);
      } catch (e) {
        console.error(e);
        setGeneralTicket(null);
      } finally {
        setSessionLoading(false);
      }
    },
    [userId, shopIdString]
  );

  useEffect(() => {
    if (selectedId == null) return;
    setTopicTicket(null);
    void refreshSessionAndTickets(selectedId);
  }, [selectedId, refreshSessionAndTickets]);

  const activeTicket = topicTicket ?? generalTicket;
  const displayOrder: MyOrderRow | null =
    activeTicket?.order != null
      ? (activeTicket.order as MyOrderRow)
      : selectedOrder;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTicket?.messages, topicTicket?.id, generalTicket?.id]);

  const canUseApi =
    Number.isFinite(userId) &&
    userId > 0 &&
    shopIdString != null &&
    /^\d+$/.test(shopIdString) &&
    selectedId != null;

  async function openTopicTicket(type: SupportTicketType) {
    if (!canUseApi || selectedOrder == null) return;
    setBusy(true);
    try {
      const t = await createSupportTicket(userId, shopIdString!, {
        orderId: selectedOrder.id,
        type,
      });
      const full = await fetchSupportTicket(userId, shopIdString!, t.id);
      setTopicTicket(full);
      await refreshSessionAndTickets(selectedOrder.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось создать обращение");
    } finally {
      setBusy(false);
    }
  }

  async function openExistingTicket(ticketId: number) {
    if (!canUseApi || selectedOrder == null) return;
    setBusy(true);
    try {
      const full = await fetchSupportTicket(userId, shopIdString!, ticketId);
      setTopicTicket(full);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!canUseApi || activeTicket == null) return;
    const text = ticketDraft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const t = await postSupportTicketMessage(
        userId,
        shopIdString!,
        activeTicket.id,
        text
      );
      if (topicTicket && topicTicket.id === t.id) setTopicTicket(t);
      else setGeneralTicket(t);
      setTicketDraft("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto() {
    if (!canUseApi || activeTicket == null || selectedId == null) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        setBusy(true);
        try {
          const { url } = await uploadSupportPhoto(
            userId,
            shopIdString!,
            selectedId,
            file
          );
          const t = await postSupportTicketMessage(
            userId,
            shopIdString!,
            activeTicket.id,
            "Фото",
            [url]
          );
          if (topicTicket && topicTicket.id === t.id) setTopicTicket(t);
          else setGeneralTicket(t);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Загрузка не удалась");
        } finally {
          setBusy(false);
        }
      })();
    };
    input.click();
  }

  async function submitReturn(order: MyOrderRow) {
    if (!canUseApi) return;
    setBusy(true);
    try {
      await createReturnRequest(userId, shopIdString!, {
        orderId: order.id,
        orderItemId: returnItemId === "" ? null : returnItemId,
        reason: returnReason,
        comment: returnComment.trim() || undefined,
        photos: returnPhotos,
      });
      alert("Заявка отправлена");
      setReturnPhotos([]);
      setReturnComment("");
      setScreen({ kind: "chat" });
      await refreshSessionAndTickets(order.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function onChip(c: QuickChip) {
    if (c.kind === "return") {
      if (!selectedOrder) return;
      setReturnItemId("");
      setReturnReason("OTHER");
      setReturnPhotos([]);
      setScreen({ kind: "return", order: selectedOrder });
      return;
    }
    if (c.kind === "draft") {
      setTicketDraft(c.text);
      return;
    }
    void openTopicTicket(c.ticketType);
  }

  const otherOpenTickets = useMemo(() => {
    const open = ticketsForOrder.filter(
      (t) =>
        String(t.status).toUpperCase() === "OPEN" &&
        String(t.type).toUpperCase() !== "GENERAL"
    );
    if (topicTicket == null) return open;
    return open.filter((t) => t.id !== topicTicket.id);
  }, [ticketsForOrder, topicTicket]);

  if (screen.kind === "return") {
    const order = screen.order;
    return (
      <div className="sf-support-hub sf-support-hub--return">
        <button
          type="button"
          className="sf-support-temu__back"
          onClick={() => setScreen({ kind: "chat" })}
        >
          ← Назад
        </button>
        <h1 className="sf-support-hub__title">Возврат</h1>
        <p className="sf-support-hub__sub">Заказ #{order.id}</p>
        <label className="sf-support-hub__field">
          <span>Позиция</span>
          <select
            className="sf-support-hub__select"
            value={returnItemId === "" ? "" : String(returnItemId)}
            disabled={busy}
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
        <label className="sf-support-hub__field">
          <span>Причина</span>
          <select
            className="sf-support-hub__select"
            value={returnReason}
            disabled={busy}
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
        <label className="sf-support-hub__field">
          <span>Комментарий</span>
          <textarea
            className="sf-support-hub__textarea"
            rows={3}
            value={returnComment}
            disabled={busy}
            onChange={(e) => setReturnComment(e.target.value)}
          />
        </label>
        <p className="sf-support-hub__muted">Фото: {returnPhotos.length}</p>
        <div className="sf-support-hub__actions">
          <button
            type="button"
            className="sf-support-hub__action"
            disabled={busy}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file || !canUseApi) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const { url } = await uploadSupportPhoto(
                      userId,
                      shopIdString!,
                      order.id,
                      file
                    );
                    setReturnPhotos((p) => [...p, url].slice(0, 8));
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "Ошибка");
                  } finally {
                    setBusy(false);
                  }
                })();
              };
              input.click();
            }}
          >
            Добавить фото
          </button>
          <button
            type="button"
            className="sf-support-hub__action sf-support-hub__action--primary"
            disabled={busy}
            onClick={() => void submitReturn(order)}
          >
            Отправить заявку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-support-hub sf-support-hub--temu">
      <header className="sf-support-temu__topbar">
        <button
          type="button"
          className="sf-support-temu__icon-btn"
          onClick={onBack}
          aria-label="Закрыть"
        >
          ←
        </button>
        <div className="sf-support-temu__brand">
          <span className="sf-support-temu__brand-name">
            {readTxt("supportHubTitle", "Поддержка")}
          </span>
          <span className="sf-support-temu__brand-sub">
            {readTxt("supportHubSubtitle", "Служба поддержки")}
          </span>
        </div>
        <span className="sf-support-temu__topbar-spacer" aria-hidden />
      </header>

      {topicTicket ? (
        <button
          type="button"
          className="sf-support-temu__back-to-general"
          onClick={() => setTopicTicket(null)}
        >
          ← К чату заказа
        </button>
      ) : null}

      <div className="sf-support-temu__scroll">
        {loading && (
          <p className="sf-support-hub__muted">{readTxt("loading", "Загрузка…")}</p>
        )}
        {error && (
          <p className="sf-support-hub__error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && orders.length === 0 && (
          <>
            <ul className="sf-support-msgs">
              <li className="sf-support-msg sf-support-msg--system">
                <span className="sf-support-msg__who">Поддержка</span>
                <p className="sf-support-msg__text">
                  Здравствуйте! Чат по заказу доступен после оформления покупки.
                </p>
              </li>
              <li className="sf-support-msg sf-support-msg--system">
                <span className="sf-support-msg__who">Поддержка</span>
                <p className="sf-support-msg__text">
                  Справка и контакты — в боковом меню. Закройте экран или
                  перейдите в каталог.
                </p>
              </li>
            </ul>
            {onGoShopping ? (
              <button
                type="button"
                className="sf-support-hub__empty-cta sf-support-hub__empty-cta--chat"
                onClick={onGoShopping}
              >
                В каталог
              </button>
            ) : null}
          </>
        )}

        {!loading && !error && orders.length > 0 && displayOrder && (
          <>
            <OrderContextCard order={displayOrder} />
            {sessionLoading && !activeTicket ? (
              <p className="sf-support-hub__muted">Подключаем чат…</p>
            ) : null}
            {activeTicket?.messages && activeTicket.messages.length > 0 ? (
              <MessageList messages={activeTicket.messages} />
            ) : null}
            <div ref={endRef} />
          </>
        )}
      </div>

      {!loading && !error && orders.length > 0 && selectedOrder && (
        <>
          {otherOpenTickets.length > 0 ? (
            <div className="sf-support-temu__open-threads" role="navigation">
              <span className="sf-support-temu__open-threads-label">
                Открытые темы
              </span>
              <div className="sf-support-temu__chips-row">
                {otherOpenTickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="sf-support-chip sf-support-chip--ghost"
                    disabled={busy}
                    onClick={() => void openExistingTicket(t.id)}
                  >
                    {String(t.type)} · #{t.id}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!topicTicket ? (
            <div className="sf-support-temu__chips-wrap">
              <div className="sf-support-temu__chips-row">
                {quickChipsForOrder(selectedOrder).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="sf-support-chip"
                    disabled={busy}
                    onClick={() => onChip(c)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sf-support-temu__composer">
            <button
              type="button"
              className="sf-support-temu__composer-icon"
              disabled={busy || !activeTicket}
              onClick={() => pickPhoto()}
              aria-label="Прикрепить фото"
            >
              🖼
            </button>
            <button
              type="button"
              className="sf-support-temu__composer-icon"
              disabled={busy}
              onClick={() => setOrderPickerOpen(true)}
              aria-label="Выбрать заказ"
            >
              📦
            </button>
            <input
              type="text"
              className="sf-support-temu__composer-input"
              placeholder={
                activeTicket
                  ? "Введите ваш запрос…"
                  : "Подождите загрузки чата…"
              }
              value={ticketDraft}
              disabled={busy || !activeTicket}
              onChange={(e) => setTicketDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendMessage();
              }}
            />
            <button
              type="button"
              className="sf-support-temu__composer-send"
              disabled={busy || !activeTicket || !ticketDraft.trim()}
              onClick={() => void sendMessage()}
            >
              →
            </button>
          </div>
        </>
      )}

      {orderPickerOpen ? (
        <div
          className="sf-support-sheet-backdrop"
          role="presentation"
          onClick={() => setOrderPickerOpen(false)}
        />
      ) : null}
      {orderPickerOpen ? (
        <div className="sf-support-sheet" role="dialog" aria-label="Выбор заказа">
          <div className="sf-support-sheet__handle" aria-hidden />
          <div className="sf-support-sheet__title">Ваш заказ</div>
          <ul className="sf-support-sheet__list">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`sf-support-sheet__item${o.id === selectedId ? " sf-support-sheet__item--current" : ""}`}
                  onClick={() => {
                    setSelectedId(o.id);
                    setOrderPickerOpen(false);
                  }}
                >
                  <span className="sf-support-sheet__item-id">№{o.id}</span>
                  <span className="sf-support-sheet__item-meta">
                    {o.total} сом · {phaseLabelRu(orderSupportPhase(o.status))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
