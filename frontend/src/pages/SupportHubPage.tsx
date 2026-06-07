import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { ArchaOverlay } from "../components/ui/ArchaOverlay";
import "../components/ui/archaOverlay.css";
import { fetchMyOrders } from "../services/myOrdersApi";
import { useShop } from "../context/ShopContext";
import { showErrorToast, showSuccessToast } from "../store/toast.store";
import { formatApiError } from "../utils/adminApiError";
import { getWebAppUserId } from "../utils/telegramUserId";
import { getTelegramUser } from "../utils/telegram";
import { telegramDisplayName } from "../utils/telegramUserMark";
import type { MyOrderRow } from "../types/myOrder";
import { orderDisplayLabel } from "@repo-shared/orderDisplay";
import {
  customerOrderActions,
  commercePhaseLabelRu,
  orderCommercePhase,
  type CustomerOrderAction,
} from "@repo-shared/orderCommerce";
import { returnReasonLabelRu } from "@repo-shared/supportLabels";
import {
  createCancelRequest,
  createRefundRequest,
  createReturnRequest,
  createSupportTicket,
  ensureGeneralSupportSession,
  postSupportTicketMessage,
  supportTicketTypeForAction,
  uploadSupportPhoto,
  type ReturnReason,
  type SupportTicketRow,
  type SupportTicketType,
} from "../services/supportCustomerApi";
import { SupportChatMessages } from "../components/support/SupportChatMessages";
import { PersonAvatar } from "../components/support/PersonAvatar";
import "./SupportHubPage.css";
import "../components/support/supportUi.css";

type HubScreen =
  | { kind: "chat" }
  | { kind: "return"; order: MyOrderRow }
  | { kind: "cancel"; order: MyOrderRow }
  | { kind: "refund"; order: MyOrderRow };

function OrderContextCard({ order }: { order: MyOrderRow }) {
  const phase = orderCommercePhase(order.status);
  const items = order.items ?? [];
  const thumbs = items.slice(0, 4);
  const n = items.reduce((s, it) => s + it.quantity, 0);
  return (
    <div className="sf-support-order-card" role="group" aria-label="Заказ">
      <div className="sf-support-order-card__status">{commercePhaseLabelRu(phase)}</div>
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
      <div className="sf-support-order-card__id">Заказ {orderDisplayLabel(order)}</div>
    </div>
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
  const tgUser = getTelegramUser();
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [screen, setScreen] = useState<HubScreen>({ kind: "chat" });
  const [sessionTicket, setSessionTicket] = useState<SupportTicketRow | null>(null);
  const [ticketDraft, setTicketDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const [returnReason, setReturnReason] = useState<ReturnReason>("OTHER");
  const [returnItemId, setReturnItemId] = useState<number | "">("");
  const [returnComment, setReturnComment] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [cancelComment, setCancelComment] = useState("");
  const [refundComment, setRefundComment] = useState("");
  const [refundReason, setRefundReason] = useState("");

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
      const active = data.filter(
        (o) => String(o.status).trim().toUpperCase() !== "CANCELLED"
      );
      setOrders(data);
      setError(null);
      setSelectedId((prev) => {
        const pool = active.length > 0 ? active : data;
        if (prev != null && pool.some((o) => o.id === prev)) return prev;
        return pool[0]?.id ?? null;
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

  const refreshSession = useCallback(
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
        const session = await ensureGeneralSupportSession(userId, shopIdString, orderId);
        setSessionTicket(session);
      } catch (e) {
        console.error(e);
        setSessionTicket(null);
      } finally {
        setSessionLoading(false);
      }
    },
    [userId, shopIdString]
  );

  useEffect(() => {
    if (selectedId == null) return;
    void refreshSession(selectedId);
  }, [selectedId, refreshSession]);

  const displayOrder: MyOrderRow | null =
    sessionTicket?.order != null
      ? (sessionTicket.order as MyOrderRow)
      : selectedOrder;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionTicket?.messages]);

  const canUseApi =
    Number.isFinite(userId) &&
    userId > 0 &&
    shopIdString != null &&
    /^\d+$/.test(shopIdString) &&
    selectedId != null;

  async function sendTopic(type: SupportTicketType, text = "") {
    if (!canUseApi || selectedOrder == null) return;
    setBusy(true);
    try {
      const t = await createSupportTicket(userId, shopIdString!, {
        orderId: selectedOrder.id,
        type,
        text,
      });
      setSessionTicket(t);
    } catch (e) {
      showErrorToast(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!canUseApi || sessionTicket == null) return;
    const text = ticketDraft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const t = await postSupportTicketMessage(
        userId,
        shopIdString!,
        sessionTicket.id,
        text
      );
      setSessionTicket(t);
      setTicketDraft("");
    } catch (e) {
      showErrorToast(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto() {
    if (!canUseApi || sessionTicket == null || selectedId == null) return;
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
            sessionTicket.id,
            "Фото",
            [url]
          );
          setSessionTicket(t);
        } catch (e) {
          showErrorToast(formatApiError(e));
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
      showSuccessToast("Заявка отправлена");
      setReturnPhotos([]);
      setReturnComment("");
      setScreen({ kind: "chat" });
      await refreshSession(order.id);
      await load();
    } catch (e) {
      showErrorToast(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCustomerAction(action: CustomerOrderAction) {
    if (!selectedOrder) return;
    if (action.kind === "cancel") {
      setCancelComment("");
      setScreen({ kind: "cancel", order: selectedOrder });
      return;
    }
    if (action.kind === "refund") {
      setRefundComment("");
      setRefundReason("");
      setScreen({ kind: "refund", order: selectedOrder });
      return;
    }
    if (action.kind === "return") {
      setReturnItemId("");
      setReturnReason("OTHER");
      setReturnPhotos([]);
      setScreen({ kind: "return", order: selectedOrder });
      return;
    }
    const ticketType = supportTicketTypeForAction(action.kind);
    if (ticketType == null) return;
    await sendTopic(ticketType);
  }

  async function submitCancel(order: MyOrderRow) {
    if (!canUseApi) return;
    setBusy(true);
    try {
      await createCancelRequest(userId, shopIdString!, {
        orderId: order.id,
        comment: cancelComment.trim() || undefined,
      });
      showSuccessToast("Заявка на отмену отправлена");
      setCancelComment("");
      setScreen({ kind: "chat" });
      await refreshSession(order.id);
      await load();
    } catch (e) {
      showErrorToast(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund(order: MyOrderRow) {
    if (!canUseApi) return;
    setBusy(true);
    try {
      await createRefundRequest(userId, shopIdString!, {
        orderId: order.id,
        reason: refundReason.trim() || undefined,
        comment: refundComment.trim() || undefined,
      });
      showSuccessToast("Заявка на возврат денег отправлена");
      setRefundComment("");
      setRefundReason("");
      setScreen({ kind: "chat" });
      await refreshSession(order.id);
      await load();
    } catch (e) {
      showErrorToast(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function onChip(c: CustomerOrderAction) {
    void handleCustomerAction(c);
  }

  const returnReasonOptions: { value: ReturnReason; label: string }[] = [
    { value: "SIZE", label: returnReasonLabelRu("SIZE") },
    { value: "DAMAGE", label: returnReasonLabelRu("DAMAGE") },
    { value: "WRONG_ITEM", label: returnReasonLabelRu("WRONG_ITEM") },
    { value: "QUALITY", label: returnReasonLabelRu("QUALITY") },
    { value: "OTHER", label: returnReasonLabelRu("OTHER") },
  ];

  if (screen.kind === "cancel") {
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
        <h1 className="sf-support-hub__title">Отмена заказа</h1>
        <p className="sf-support-hub__sub">Заказ {orderDisplayLabel(order)}</p>
        <p className="sf-support-hub__muted">
          Доступно до оплаты. Магазин рассмотрит заявку вручную.
        </p>
        <label className="sf-support-hub__field">
          <span>Комментарий</span>
          <textarea
            className="sf-support-hub__textarea"
            rows={3}
            value={cancelComment}
            disabled={busy}
            onChange={(e) => setCancelComment(e.target.value)}
          />
        </label>
        <div className="sf-support-hub__actions">
          <button
            type="button"
            className="sf-support-hub__action sf-support-hub__action--primary"
            disabled={busy}
            onClick={() => void submitCancel(order)}
          >
            Отправить заявку
          </button>
        </div>
      </div>
    );
  }

  if (screen.kind === "refund") {
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
        <h1 className="sf-support-hub__title">Возврат денег</h1>
        <p className="sf-support-hub__sub">Заказ {orderDisplayLabel(order)}</p>
        <label className="sf-support-hub__field">
          <span>Причина</span>
          <input
            className="sf-support-hub__select"
            type="text"
            value={refundReason}
            disabled={busy}
            onChange={(e) => setRefundReason(e.target.value)}
          />
        </label>
        <label className="sf-support-hub__field">
          <span>Комментарий</span>
          <textarea
            className="sf-support-hub__textarea"
            rows={3}
            value={refundComment}
            disabled={busy}
            onChange={(e) => setRefundComment(e.target.value)}
          />
        </label>
        <div className="sf-support-hub__actions">
          <button
            type="button"
            className="sf-support-hub__action sf-support-hub__action--primary"
            disabled={busy}
            onClick={() => void submitRefund(order)}
          >
            Отправить заявку
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="sf-support-hub__title">Возврат товара</h1>
        <p className="sf-support-hub__sub">Заказ {orderDisplayLabel(order)}</p>
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
            {returnReasonOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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
                    showErrorToast(formatApiError(e));
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
          <PersonAvatar
            name={telegramDisplayName(tgUser)}
            photoUrl={tgUser?.photo_url}
            size="sm"
          />
          <div>
            <span className="sf-support-temu__brand-name">
              {readTxt("supportHubTitle", "Поддержка")}
            </span>
            <span className="sf-support-temu__brand-sub">
              {telegramDisplayName(tgUser)}
              {tgUser?.username ? ` · @${tgUser.username}` : ""}
            </span>
          </div>
        </div>
        <span className="sf-support-temu__topbar-spacer" aria-hidden />
      </header>

      <div className="sf-support-temu__scroll">
        {loading && (
          <p className="sf-support-hub__muted">{readTxt("loading", "Загрузка…")}</p>
        )}
        {error && (
          <div className="sf-support-hub__error-wrap" role="alert">
            <p className="sf-support-hub__error">{error}</p>
            <button
              type="button"
              className="sf-support-hub__retry"
              onClick={() => void load()}
            >
              {readTxt("retry", "Повторить")}
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <>
            <SupportChatMessages
              messages={[
                {
                  senderType: "SYSTEM",
                  text: "Здравствуйте! Чат по заказу доступен после оформления покупки.",
                },
                {
                  senderType: "SYSTEM",
                  text: "Справка и контакты — в боковом меню. Закройте экран или перейдите в каталог.",
                },
              ]}
            />
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
            {sessionLoading && !sessionTicket ? (
              <p className="sf-support-hub__muted">Подключаем чат…</p>
            ) : null}
            {sessionTicket?.messages && sessionTicket.messages.length > 0 ? (
              <SupportChatMessages messages={sessionTicket.messages} />
            ) : null}
            <div ref={endRef} />
          </>
        )}
      </div>

      {!loading && !error && orders.length > 0 && selectedOrder && (
        <>
          <div className="sf-support-temu__chips-wrap">
            <div className="sf-support-temu__chips-row">
              {customerOrderActions(orderCommercePhase(selectedOrder.status)).map((c) => (
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

          <div className="sf-support-temu__composer">
            <button
              type="button"
              className="sf-support-temu__composer-icon"
              disabled={busy || !sessionTicket}
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
                sessionTicket
                  ? "Напишите сообщение…"
                  : "Подождите загрузки чата…"
              }
              value={ticketDraft}
              disabled={busy || !sessionTicket}
              onChange={(e) => setTicketDraft(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendMessage();
              }}
            />
            <button
              type="button"
              className="sf-support-temu__composer-send"
              disabled={busy || !sessionTicket || !ticketDraft.trim()}
              onClick={() => void sendMessage()}
            >
              →
            </button>
          </div>
        </>
      )}

      <ArchaOverlay
        open={orderPickerOpen}
        onClose={() => setOrderPickerOpen(false)}
        ariaLabel="Выбор заказа"
        layer="support"
        panelClassName="sf-support-sheet"
      >
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
                <span className="sf-support-sheet__item-id">{orderDisplayLabel(o)}</span>
                <span className="sf-support-sheet__item-meta">
                  {o.total} сом · {commercePhaseLabelRu(orderCommercePhase(o.status))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ArchaOverlay>
    </div>
  );
}
