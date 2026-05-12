import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { useShop } from "../context/ShopContext";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { getWebAppUserId } from "../utils/telegramUserId";
import type { MyOrderRow } from "../types/myOrder";
import { orderSupportPhase, type SupportPhase } from "@repo-shared/supportPhase";
import {
  createReturnRequest,
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTicketsForOrder,
  postSupportTicketMessage,
  uploadSupportPhoto,
  type ReturnReason,
  type SupportTicketRow,
  type SupportTicketType,
} from "../services/supportCustomerApi";
import "./SupportHubPage.css";

type HubScreen =
  | { kind: "hub" }
  | { kind: "ticket"; orderId: number; ticketId: number }
  | { kind: "return"; order: MyOrderRow };

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

function ChatThread({
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
    <div className="sf-support-chat__thread">
      <ul className="sf-support-chat__msgs">
        {msgs.map((m, i) => (
          <li key={m.id ?? i} className="sf-support-chat__msg">
            <span className="sf-support-chat__msg-sender">{m.senderType}</span>
            <p className="sf-support-chat__msg-text">{m.text}</p>
          </li>
        ))}
      </ul>
      <div className="sf-support-chat__composer-tools">
        <button
          type="button"
          className="sf-support-chat__chip-btn"
          disabled={busy}
          onClick={() => onAddPhoto()}
        >
          📎 Фото
        </button>
      </div>
      <textarea
        className="sf-support-chat__input"
        rows={3}
        placeholder="Сообщение магазину…"
        value={draft}
        disabled={busy}
        onChange={(e) => onDraft(e.target.value)}
      />
      <button
        type="button"
        className="sf-support-chat__send"
        disabled={busy || !draft.trim()}
        onClick={() => onSend()}
      >
        Отправить
      </button>
    </div>
  );
}

type SupportHubPageProps = {
  onBack: () => void;
  /** Когда нет заказов — переход в витрину. */
  onGoShopping?: () => void;
};

export default function SupportHubPage({
  onBack,
  onGoShopping,
}: SupportHubPageProps) {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [screen, setScreen] = useState<HubScreen>({ kind: "hub" });
  const [ticketRow, setTicketRow] = useState<SupportTicketRow | null>(null);
  const [ticketsForOrder, setTicketsForOrder] = useState<SupportTicketRow[]>([]);
  const [ticketDraft, setTicketDraft] = useState("");
  const [busy, setBusy] = useState(false);

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

  const refreshTickets = useCallback(
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
        const tix = await fetchSupportTicketsForOrder(
          userId,
          shopIdString,
          orderId
        );
        setTicketsForOrder(tix);
      } catch (e) {
        console.error(e);
      }
    },
    [userId, shopIdString]
  );

  useEffect(() => {
    if (selectedOrder) void refreshTickets(selectedOrder.id);
  }, [selectedOrder, refreshTickets]);

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
    setBusy(true);
    try {
      const t = await createSupportTicket(userId, shopIdString, {
        orderId: order.id,
        type,
      });
      setScreen({ kind: "ticket", orderId: order.id, ticketId: t.id });
      await refreshTickets(order.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось создать обращение");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
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
    setBusy(true);
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
      setBusy(false);
    }
  }

  function pickPhoto(orderId: number) {
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
        setBusy(true);
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
          setBusy(false);
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
    setBusy(true);
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
      await refreshTickets(order.id);
      setScreen({ kind: "hub" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (screen.kind === "ticket") {
    if (!ticketRow) {
      return (
        <div className="sf-support-hub">
          <button
            type="button"
            className="sf-support-hub__back"
            onClick={() => {
              setTicketRow(null);
              setScreen({ kind: "hub" });
            }}
          >
            ← К сценариям
          </button>
          <p className="sf-support-hub__muted">Загрузка диалога…</p>
        </div>
      );
    }
    return (
      <div className="sf-support-hub sf-support-hub--chat">
        <header className="sf-support-hub__chat-top">
          <button
            type="button"
            className="sf-support-hub__back sf-support-hub__back--inline"
            onClick={() => {
              setTicketRow(null);
              setScreen({ kind: "hub" });
            }}
          >
            ←
          </button>
          <div className="sf-support-hub__chat-top-meta">
            <h1 className="sf-support-hub__chat-title">
              Диалог · #{screen.ticketId}
            </h1>
            <p className="sf-support-hub__chat-sub">Заказ #{screen.orderId}</p>
          </div>
        </header>
        <ChatThread
          ticket={ticketRow}
          busy={busy}
          draft={ticketDraft}
          onDraft={setTicketDraft}
          onSend={() => void sendMessage()}
          onAddPhoto={() => pickPhoto(screen.orderId)}
        />
        <button
          type="button"
          className="sf-support-hub__text-exit"
          onClick={onBack}
        >
          На главную
        </button>
      </div>
    );
  }

  if (screen.kind === "return") {
    const order = screen.order;
    return (
      <div className="sf-support-hub">
        <button
          type="button"
          className="sf-support-hub__back"
          onClick={() => setScreen({ kind: "hub" })}
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
            onClick={() => pickPhoto(order.id)}
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

  const renderScenarioGrid = (order: MyOrderRow) => {
    const phase = orderSupportPhase(order.status);
    const tracking =
      order.tracking != null && String(order.tracking).trim() !== ""
        ? String(order.tracking).trim()
        : null;

    return (
      <div className="sf-support-hub__scenarios">
        {phase === "CANCELLED" && (
          <button
            type="button"
            className="sf-support-hub__scenario"
            disabled={busy}
            onClick={() => void openScenario(order, "GENERAL")}
          >
            <span className="sf-support-hub__scenario-title">
              Связаться с поддержкой
            </span>
            <span className="sf-support-hub__scenario-desc">
              Уточнение по отменённому заказу
            </span>
          </button>
        )}

        {phase === "PROCESSING" && (
          <>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "CANCEL_REQUEST")}
            >
              <span className="sf-support-hub__scenario-title">
                Отмена заказа
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "EXCHANGE")}
            >
              <span className="sf-support-hub__scenario-title">
                Обмен размера
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "QUALITY")}
            >
              <span className="sf-support-hub__scenario-title">
                Проблема с заказом
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "TRACKING")}
            >
              <span className="sf-support-hub__scenario-title">
                Где моя посылка
              </span>
              <span className="sf-support-hub__scenario-desc">
                Статус отправки
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "GENERAL")}
            >
              <span className="sf-support-hub__scenario-title">
                Связаться с поддержкой
              </span>
            </button>
          </>
        )}

        {phase === "SHIPPING" && (
          <>
            {tracking ? (
              <div className="sf-support-hub__tracking-card">
                <span className="sf-support-hub__tracking-label">Трек-номер</span>
                <span className="sf-support-hub__tracking-value">{tracking}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="sf-support-hub__scenario sf-support-hub__scenario--accent"
              disabled={busy}
              onClick={() => void openScenario(order, "TRACKING")}
            >
              <span className="sf-support-hub__scenario-title">
                Где моя посылка
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "DELIVERY")}
            >
              <span className="sf-support-hub__scenario-title">
                Проблема с доставкой
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "RETURN")}
            >
              <span className="sf-support-hub__scenario-title">
                Возврат товара
              </span>
              <span className="sf-support-hub__scenario-desc">
                Вопрос до получения
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "QUALITY")}
            >
              <span className="sf-support-hub__scenario-title">
                Проблема с заказом
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "GENERAL")}
            >
              <span className="sf-support-hub__scenario-title">
                Связаться с поддержкой
              </span>
            </button>
          </>
        )}

        {phase === "DELIVERED" && (
          <>
            {tracking ? (
              <div className="sf-support-hub__tracking-card">
                <span className="sf-support-hub__tracking-label">Был отправлен</span>
                <span className="sf-support-hub__tracking-value">{tracking}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="sf-support-hub__scenario sf-support-hub__scenario--accent"
              disabled={busy}
              onClick={() => {
                setReturnItemId("");
                setReturnReason("OTHER");
                setReturnPhotos([]);
                setScreen({ kind: "return", order });
              }}
            >
              <span className="sf-support-hub__scenario-title">
                Возврат товара
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "EXCHANGE")}
            >
              <span className="sf-support-hub__scenario-title">
                Обмен размера
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "QUALITY")}
            >
              <span className="sf-support-hub__scenario-title">
                Проблема с заказом
              </span>
            </button>
            <button
              type="button"
              className="sf-support-hub__scenario"
              disabled={busy}
              onClick={() => void openScenario(order, "GENERAL")}
            >
              <span className="sf-support-hub__scenario-title">
                Связаться с поддержкой
              </span>
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="sf-support-hub">
      <button type="button" className="sf-support-hub__back" onClick={onBack}>
        ← {readTxt("supportHubBackLabel", "Закрыть")}
      </button>
      <header className="sf-support-hub__header">
        <h1 className="sf-support-hub__title">
          {readTxt("supportHubTitle", "Поддержка")}
        </h1>
        <p className="sf-support-hub__lead">
          {readTxt(
            "supportHubLead",
            "Выберите заказ и сценарий — ответит магазин в чате."
          )}
        </p>
      </header>

      {loading && (
        <p className="sf-support-hub__muted">{readTxt("loading", "Загрузка…")}</p>
      )}
      {error && (
        <p className="sf-support-hub__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="sf-support-hub__empty">
          <p className="sf-support-hub__empty-title">Пока нет заказов</p>
          <p className="sf-support-hub__empty-text">
            Чат по заказу откроется после покупки. Справка и контакты — в боковом
            меню.
          </p>
          {onGoShopping ? (
            <button
              type="button"
              className="sf-support-hub__empty-cta"
              onClick={onGoShopping}
            >
              В каталог
            </button>
          ) : null}
        </div>
      )}

      {!loading && !error && orders.length > 0 && selectedOrder && (
        <>
          <label className="sf-support-hub__field">
            <span>Заказ для обращения</span>
            <select
              className="sf-support-hub__select"
              value={String(selectedId ?? "")}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} · {o.total} сом · {o.status}
                </option>
              ))}
            </select>
          </label>

          <div className="sf-support-hub__phase-pill">
            <span className="sf-support-hub__phase-label">Статус</span>
            <span className="sf-support-hub__phase-value">
              {phaseLabelRu(orderSupportPhase(selectedOrder.status))}
            </span>
          </div>

          <h2 className="sf-support-hub__section-title">Чем помочь?</h2>
          {renderScenarioGrid(selectedOrder)}

          {ticketsForOrder.length > 0 && (
            <section className="sf-support-hub__cases">
              <h2 className="sf-support-hub__section-title">Ваши обращения</h2>
              <ul className="sf-support-hub__case-list">
                {ticketsForOrder.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="sf-support-hub__case-btn"
                      onClick={() =>
                        setScreen({
                          kind: "ticket",
                          orderId: selectedOrder.id,
                          ticketId: t.id,
                        })
                      }
                    >
                      #{t.id} · {t.type} · {t.status}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
