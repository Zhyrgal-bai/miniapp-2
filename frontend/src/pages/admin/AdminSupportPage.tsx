import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService, type SupportSuggestion } from "../../services/admin.service";
import { SF_ADMIN_SUPPORT_TAB_KEY } from "../../utils/accountMenuStorage";
import { formatTimeAgoRu } from "../../utils/formatTimeAgo";
import { orderDisplayLabel } from "@repo-shared/orderDisplay";
import {
  mapStatus,
  RETURN_STATUS_RU,
  TICKET_STATUS_RU,
  TICKET_TYPE_RU,
} from "../../i18n/statusMaps";
import {
  cancelStatusLabelRu,
  refundStatusLabelRu,
} from "@repo-shared/orderRequestLabels";
import { RequestTimeline } from "../../components/support/RequestTimeline";
import { PersonAvatar } from "../../components/support/PersonAvatar";
import { SupportChatMessages } from "../../components/support/SupportChatMessages";
import type { SupportMessageRow } from "../../services/supportCustomerApi";
import "../../components/support/supportUi.css";

type Tab = "tickets" | "cancellations" | "refunds" | "returns";

type InboxTicket = {
  id: number;
  status: string;
  type: string;
  orderId: number;
  customerDisplayName?: string;
  customerInitial?: string;
  lastMessageText?: string | null;
  lastMessageAt?: string;
  orderLabel?: string;
  needsReply?: boolean;
  order?: { id: number; orderNumber?: string | null; name?: string | null };
  messages?: SupportMessageRow[];
};

type TicketDetail = InboxTicket & {
  messages: SupportMessageRow[];
  internalNote?: string | null;
};

const TICKET_STATUS_OPTIONS = [
  "OPEN",
  "PENDING_CUSTOMER",
  "PENDING_MERCHANT",
  "RESOLVED",
  "CLOSED",
] as const;

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function asInboxTicket(row: unknown): InboxTicket | null {
  if (!row || typeof row !== "object") return null;
  const id = (row as { id?: unknown }).id;
  if (typeof id !== "number") return null;
  return row as InboxTicket;
}

function lastMessagePreview(row: InboxTicket): string {
  const direct = row.lastMessageText?.trim();
  if (direct) return direct.length > 100 ? `${direct.slice(0, 97)}…` : direct;
  const messages = row.messages;
  if (!Array.isArray(messages) || messages.length === 0) return "Нет сообщений";
  const last = messages[messages.length - 1];
  const t = last?.text?.trim() ?? "";
  return t.length > 100 ? `${t.slice(0, 97)}…` : t || "—";
}

function orderLabelForTicket(row: InboxTicket): string {
  if (row.orderLabel?.trim()) return row.orderLabel;
  if (row.order) return orderDisplayLabel(row.order);
  return "Заказ";
}

export default function AdminSupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [cancellations, setCancellations] = useState<unknown[]>([]);
  const [refunds, setRefunds] = useState<unknown[]>([]);
  const [returns, setReturns] = useState<unknown[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedCancelId, setSelectedCancelId] = useState<number | null>(null);
  const [selectedRefundId, setSelectedRefundId] = useState<number | null>(null);
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [suggestions, setSuggestions] = useState<SupportSuggestion[]>([]);
  const [internalNote, setInternalNote] = useState("");
  const [merchantComment, setMerchantComment] = useState("");
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    const data = await adminService.listSupportTickets();
    const parsed = (Array.isArray(data) ? data : [])
      .map(asInboxTicket)
      .filter((t): t is InboxTicket => t != null);
    setTickets(parsed);
  }, []);

  const loadCancellations = useCallback(async () => {
    const data = await adminService.listCancelRequests();
    setCancellations(data);
  }, []);

  const loadRefunds = useCallback(async () => {
    const data = await adminService.listRefundRequests();
    setRefunds(data);
  }, []);

  const loadReturns = useCallback(async () => {
    const data = await adminService.listReturnRequests();
    setReturns(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTickets(),
        loadCancellations(),
        loadRefunds(),
        loadReturns(),
      ]);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [loadTickets, loadCancellations, loadRefunds, loadReturns]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const raw = sessionStorage.getItem(SF_ADMIN_SUPPORT_TAB_KEY);
    if (raw === "returns") setTab("returns");
    if (raw === "cancellations") setTab("cancellations");
    if (raw === "refunds") setTab("refunds");
    if (raw === "returns" || raw === "tickets" || raw === "cancellations" || raw === "refunds") {
      sessionStorage.removeItem(SF_ADMIN_SUPPORT_TAB_KEY);
    }
  }, []);

  useEffect(() => {
    if (selectedTicketId == null) {
      setTicketDetail(null);
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [d, sug] = await Promise.all([
          adminService.getSupportTicket(selectedTicketId),
          adminService.getSupportSuggestions(selectedTicketId),
        ]);
        if (!cancelled && d && typeof d === "object") {
          setTicketDetail(d as TicketDetail);
          setSuggestions(sug);
          const note =
            "internalNote" in d &&
            typeof (d as { internalNote?: unknown }).internalNote === "string"
              ? (d as { internalNote: string }).internalNote
              : "";
          setInternalNote(note);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setTicketDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTicketId]);

  const selectedCancel = useMemo(() => {
    if (selectedCancelId == null) return null;
    for (const r of cancellations) {
      if (r && typeof r === "object" && (r as { id?: unknown }).id === selectedCancelId) {
        return r as Record<string, unknown>;
      }
    }
    return null;
  }, [cancellations, selectedCancelId]);

  const selectedRefund = useMemo(() => {
    if (selectedRefundId == null) return null;
    for (const r of refunds) {
      if (r && typeof r === "object" && (r as { id?: unknown }).id === selectedRefundId) {
        return r as Record<string, unknown>;
      }
    }
    return null;
  }, [refunds, selectedRefundId]);

  const selectedReturn = useMemo(() => {
    if (selectedReturnId == null) return null;
    for (const r of returns) {
      if (
        r &&
        typeof r === "object" &&
        (r as { id?: unknown }).id === selectedReturnId
      ) {
        return r as Record<string, unknown>;
      }
    }
    return null;
  }, [returns, selectedReturnId]);

  async function sendReply() {
    if (selectedTicketId == null) return;
    const text = replyText.trim();
    if (!text) return;
    setBusy(true);
    try {
      await adminService.postSupportTicketMessage(selectedTicketId, text);
      setReplyText("");
      const d = await adminService.getSupportTicket(selectedTicketId);
      setTicketDetail(d as TicketDetail);
      await loadTickets();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  async function saveTicketPatch(patch: {
    status?: string;
    internalNote?: string | null;
  }) {
    if (selectedTicketId == null) return;
    setBusy(true);
    try {
      const d = await adminService.patchSupportTicket(selectedTicketId, patch);
      setTicketDetail(d as TicketDetail);
      await loadTickets();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selectedCancel) {
      const c = pickString(selectedCancel.merchantComment);
      setMerchantComment(c ?? "");
    } else if (selectedRefund) {
      const c = pickString(selectedRefund.merchantComment);
      setMerchantComment(c ?? "");
    } else {
      setMerchantComment("");
    }
  }, [selectedCancel, selectedRefund]);

  async function patchCancel(
    id: number,
    patch: { status: string; merchantComment?: string | null }
  ) {
    setBusy(true);
    try {
      await adminService.patchCancelRequest(id, patch);
      await loadCancellations();
      await loadTickets();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function patchRefund(
    id: number,
    patch: {
      status: string;
      merchantComment?: string | null;
      refundAmount?: number | null;
    }
  ) {
    setBusy(true);
    try {
      await adminService.patchRefundRequest(id, patch);
      await loadRefunds();
      await loadTickets();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function patchReturn(
    id: number,
    patch: { status: string; refundAmount?: number | null }
  ) {
    setBusy(true);
    try {
      await adminService.patchReturnRequest(id, patch);
      await loadReturns();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const detailMessages = useMemo(() => {
    if (!ticketDetail?.messages) return [];
    return ticketDetail.messages;
  }, [ticketDetail]);

  const detailCustomerName =
    ticketDetail?.customerDisplayName?.trim() ||
    ticketDetail?.order?.name?.trim() ||
    "Покупатель";

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Сообщения покупателей</h1>
        <p className="admin-dash-page__subtitle">
          Чат по заказам и заявки на возврат — как в мессенджере.
        </p>
      </header>

      <div className="admin-form-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "tickets" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("tickets")}
        >
          Диалоги
        </button>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "cancellations" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("cancellations")}
        >
          Отмены
        </button>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "refunds" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("refunds")}
        >
          Возврат денег
        </button>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "returns" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("returns")}
        >
          Возврат товара
        </button>
        <button
          type="button"
          className="admin-order-card__btn admin-order-card__btn--ship"
          disabled={loading}
          onClick={() => void loadAll()}
        >
          Обновить
        </button>
      </div>

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}

      {!loading && tab === "tickets" && (
        <div className="admin-support-grid">
          <div className="sf-inbox admin-support-list">
            {tickets.length === 0 && (
              <p className="admin-dash-page__muted" style={{ padding: 16 }}>
                Пока нет сообщений
              </p>
            )}
            {tickets.map((row) => {
              const active = selectedTicketId === row.id;
              const name = row.customerDisplayName?.trim() || "Покупатель";
              const when = formatTimeAgoRu(row.lastMessageAt);
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`sf-inbox__item admin-support-list__item${active ? " admin-support-list__item--active sf-inbox__item--active" : ""}${row.needsReply ? " sf-inbox__item--unread" : ""}`}
                  onClick={() => setSelectedTicketId(row.id)}
                >
                  <PersonAvatar name={name} size="md" />
                  <div className="sf-inbox__body">
                    <div className="sf-inbox__top">
                      <span className="sf-inbox__name">{name}</span>
                      {when ? (
                        <span className="sf-inbox__time">{when}</span>
                      ) : null}
                    </div>
                    <div className="sf-inbox__meta">
                      {orderLabelForTicket(row)}
                      {" · "}
                      {mapStatus(row.type, TICKET_TYPE_RU)}
                    </div>
                    <div className="sf-inbox__preview">{lastMessagePreview(row)}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="admin-support-detail sf-inbox-chat">
            {selectedTicketId == null && (
              <p className="admin-dash-page__muted">Выберите диалог</p>
            )}
            {selectedTicketId != null && ticketDetail != null ? (
              <>
                <header className="sf-inbox-chat__header">
                  <PersonAvatar name={detailCustomerName} size="lg" />
                  <div>
                    <h2 className="sf-inbox-chat__title">{detailCustomerName}</h2>
                    <p className="sf-inbox-chat__sub">
                      {ticketDetail.orderLabel ??
                        (ticketDetail.order
                          ? orderDisplayLabel(ticketDetail.order)
                          : "Заказ")}
                      {" · "}
                      {mapStatus(ticketDetail.status, TICKET_STATUS_RU)}
                    </p>
                  </div>
                </header>

                <div className="admin-form-row">
                  <label className="admin-field-label" htmlFor="ticket-status">
                    Статус диалога
                  </label>
                  <select
                    id="ticket-status"
                    className="admin-input"
                    value={pickString(ticketDetail.status) ?? "OPEN"}
                    disabled={busy}
                    onChange={(e) =>
                      void saveTicketPatch({ status: e.target.value })
                    }
                  >
                    {TICKET_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {mapStatus(s, TICKET_STATUS_RU)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sf-inbox-chat__messages">
                  <SupportChatMessages
                    messages={detailMessages}
                    perspective="merchant"
                    customerAvatarName={detailCustomerName}
                    merchantAvatarName="Вы"
                  />
                </div>

                <div className="admin-form-row">
                  <span className="admin-field-label">Быстрые ответы</span>
                  {suggestions.length > 0 ? (
                    <div className="admin-support-suggestions">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="admin-support-suggestions__chip"
                          disabled={busy}
                          title={s.text}
                          onClick={() => setReplyText(s.text)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-dash-page__muted" style={{ margin: 0 }}>
                      Подсказки появятся после загрузки диалога
                    </p>
                  )}
                  <label className="admin-field-label" htmlFor="reply-text">
                    Ответ покупателю
                  </label>
                  <textarea
                    id="reply-text"
                    className="admin-input"
                    rows={3}
                    value={replyText}
                    disabled={busy}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Напишите ответ…"
                  />
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--ship"
                    disabled={busy || !replyText.trim()}
                    onClick={() => void sendReply()}
                  >
                    Отправить
                  </button>
                </div>

                <details className="admin-support-internal">
                  <summary className="admin-field-label">Заметка для себя</summary>
                  <textarea
                    id="internal-note"
                    className="admin-input"
                    rows={2}
                    value={internalNote}
                    disabled={busy}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--confirm"
                    disabled={busy}
                    onClick={() =>
                      void saveTicketPatch({
                        internalNote: internalNote.trim() || null,
                      })
                    }
                  >
                    Сохранить
                  </button>
                </details>
              </>
            ) : null}
          </div>
        </div>
      )}

      {!loading && tab === "cancellations" && (
        <div className="admin-support-grid">
          <div className="sf-inbox admin-support-list">
            {cancellations.length === 0 && (
              <p className="admin-dash-page__muted" style={{ padding: 16 }}>
                Нет заявок на отмену
              </p>
            )}
            {cancellations.map((row) => {
              if (!row || typeof row !== "object") return null;
              const id = (row as { id?: unknown }).id;
              if (typeof id !== "number") return null;
              const active = selectedCancelId === id;
              const order = (row as { order?: { orderNumber?: string | null; id?: number } }).order;
              const orderLbl = order
                ? orderDisplayLabel(order as { id: number; orderNumber?: string | null })
                : "Заказ";
              return (
                <button
                  key={id}
                  type="button"
                  className={`sf-inbox__item admin-support-list__item${active ? " admin-support-list__item--active sf-inbox__item--active" : ""}`}
                  onClick={() => setSelectedCancelId(id)}
                >
                  <PersonAvatar name={orderLbl} size="md" />
                  <div className="sf-inbox__body">
                    <div className="sf-inbox__top">
                      <span className="sf-inbox__name">{orderLbl}</span>
                    </div>
                    <div className="sf-inbox__meta">
                      {cancelStatusLabelRu(pickString((row as { status?: unknown }).status))}
                    </div>
                    <div className="sf-inbox__preview">
                      {pickString((row as { comment?: unknown }).comment) ?? "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="admin-support-detail">
            {!selectedCancel && (
              <p className="admin-dash-page__muted">Выберите заявку</p>
            )}
            {selectedCancel && (
              <>
                <h2 className="admin-support-detail__title">Отмена заказа</h2>
                <p>
                  Статус:{" "}
                  <strong>{cancelStatusLabelRu(pickString(selectedCancel.status))}</strong>
                </p>
                {pickString(selectedCancel.comment) ? (
                  <p>Комментарий покупателя: {pickString(selectedCancel.comment)}</p>
                ) : null}
                <RequestTimeline kind="cancel" status={pickString(selectedCancel.status) ?? "PENDING"} />
                <label className="admin-field-label" htmlFor="cancel-merchant-comment">
                  Комментарий магазина
                </label>
                <textarea
                  id="cancel-merchant-comment"
                  className="admin-input"
                  rows={2}
                  value={merchantComment}
                  disabled={busy}
                  onChange={(e) => setMerchantComment(e.target.value)}
                />
                {pickString(selectedCancel.status) === "PENDING" && (
                  <div className="admin-form-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--confirm"
                      disabled={busy}
                      onClick={() =>
                        void patchCancel(selectedCancelId!, {
                          status: "APPROVED",
                          merchantComment: merchantComment.trim() || null,
                        })
                      }
                    >
                      Одобрить отмену
                    </button>
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--reject"
                      disabled={busy}
                      onClick={() =>
                        void patchCancel(selectedCancelId!, {
                          status: "REJECTED",
                          merchantComment: merchantComment.trim() || null,
                        })
                      }
                    >
                      Отклонить
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "refunds" && (
        <div className="admin-support-grid">
          <div className="sf-inbox admin-support-list">
            {refunds.length === 0 && (
              <p className="admin-dash-page__muted" style={{ padding: 16 }}>
                Нет заявок на возврат денег
              </p>
            )}
            {refunds.map((row) => {
              if (!row || typeof row !== "object") return null;
              const id = (row as { id?: unknown }).id;
              if (typeof id !== "number") return null;
              const active = selectedRefundId === id;
              const order = (row as { order?: { orderNumber?: string | null; id?: number } }).order;
              const orderLbl = order
                ? orderDisplayLabel(order as { id: number; orderNumber?: string | null })
                : "Заказ";
              return (
                <button
                  key={id}
                  type="button"
                  className={`sf-inbox__item admin-support-list__item${active ? " admin-support-list__item--active sf-inbox__item--active" : ""}`}
                  onClick={() => setSelectedRefundId(id)}
                >
                  <PersonAvatar name={orderLbl} size="md" />
                  <div className="sf-inbox__body">
                    <div className="sf-inbox__top">
                      <span className="sf-inbox__name">{orderLbl}</span>
                    </div>
                    <div className="sf-inbox__meta">
                      {refundStatusLabelRu(pickString((row as { status?: unknown }).status))}
                    </div>
                    <div className="sf-inbox__preview">
                      {pickString((row as { comment?: unknown }).comment) ?? "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="admin-support-detail">
            {!selectedRefund && (
              <p className="admin-dash-page__muted">Выберите заявку</p>
            )}
            {selectedRefund && (
              <>
                <h2 className="admin-support-detail__title">Возврат денег</h2>
                <p>
                  Статус:{" "}
                  <strong>{refundStatusLabelRu(pickString(selectedRefund.status))}</strong>
                </p>
                {pickString(selectedRefund.comment) ? (
                  <p>Комментарий покупателя: {pickString(selectedRefund.comment)}</p>
                ) : null}
                <RequestTimeline kind="refund" status={pickString(selectedRefund.status) ?? "REQUESTED"} />
                <label className="admin-field-label" htmlFor="refund-merchant-comment">
                  Комментарий магазина
                </label>
                <textarea
                  id="refund-merchant-comment"
                  className="admin-input"
                  rows={2}
                  value={merchantComment}
                  disabled={busy}
                  onChange={(e) => setMerchantComment(e.target.value)}
                />
                <div className="admin-form-row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {pickString(selectedRefund.status) === "REQUESTED" && (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--ship"
                      disabled={busy}
                      onClick={() =>
                        void patchRefund(selectedRefundId!, {
                          status: "REVIEWING",
                          merchantComment: merchantComment.trim() || null,
                        })
                      }
                    >
                      Взять в проверку
                    </button>
                  )}
                  {["REQUESTED", "REVIEWING"].includes(pickString(selectedRefund.status) ?? "") && (
                    <>
                      <button
                        type="button"
                        className="admin-order-card__btn admin-order-card__btn--confirm"
                        disabled={busy}
                        onClick={() =>
                          void patchRefund(selectedRefundId!, {
                            status: "APPROVED",
                            merchantComment: merchantComment.trim() || null,
                          })
                        }
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        className="admin-order-card__btn admin-order-card__btn--reject"
                        disabled={busy}
                        onClick={() =>
                          void patchRefund(selectedRefundId!, {
                            status: "REJECTED",
                            merchantComment: merchantComment.trim() || null,
                          })
                        }
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                  {pickString(selectedRefund.status) === "APPROVED" && (
                    <button
                      type="button"
                      className="admin-order-card__btn admin-order-card__btn--confirm"
                      disabled={busy}
                      onClick={() => {
                        const orderTotal = (selectedRefund.order as { total?: number } | undefined)?.total;
                        const raw = window.prompt(
                          "Сумма возврата (сом, целое число)",
                          String(orderTotal ?? "")
                        );
                        if (raw == null) return;
                        const n = Number(raw.trim());
                        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
                          alert("Нужно целое число ≥ 0");
                          return;
                        }
                        void patchRefund(selectedRefundId!, {
                          status: "REFUNDED",
                          refundAmount: n,
                          merchantComment: merchantComment.trim() || null,
                        });
                      }}
                    >
                      Деньги возвращены
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "returns" && (
        <div className="admin-support-grid">
          <div className="sf-inbox admin-support-list">
            {returns.length === 0 && (
              <p className="admin-dash-page__muted" style={{ padding: 16 }}>
                Нет заявок на возврат
              </p>
            )}
            {returns.map((row) => {
              if (!row || typeof row !== "object") return null;
              const id = (row as { id?: unknown }).id;
              if (typeof id !== "number") return null;
              const active = selectedReturnId === id;
              const order = (row as { order?: { orderNumber?: string | null; id?: number } })
                .order;
              const orderLbl = order ? orderDisplayLabel(order as { id: number; orderNumber?: string | null }) : "Заказ";
              return (
                <button
                  key={id}
                  type="button"
                  className={`sf-inbox__item admin-support-list__item${active ? " admin-support-list__item--active sf-inbox__item--active" : ""}`}
                  onClick={() => setSelectedReturnId(id)}
                >
                  <PersonAvatar name={orderLbl} size="md" />
                  <div className="sf-inbox__body">
                    <div className="sf-inbox__top">
                      <span className="sf-inbox__name">{orderLbl}</span>
                    </div>
                    <div className="sf-inbox__meta">
                      {mapStatus(pickString((row as { status?: unknown }).status), RETURN_STATUS_RU)}
                    </div>
                    <div className="sf-inbox__preview">
                      {pickString((row as { reason?: unknown }).reason) ?? "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="admin-support-detail">
            {!selectedReturn && (
              <p className="admin-dash-page__muted">Выберите заявку</p>
            )}
            {selectedReturn && (
              <>
                <h2 className="admin-support-detail__title">Возврат</h2>
                <p>
                  Заказ:{" "}
                  <strong>
                    {(selectedReturn.order as { orderNumber?: string } | undefined)
                      ? orderDisplayLabel(
                          selectedReturn.order as {
                            id: number;
                            orderNumber?: string | null;
                          }
                        )
                      : "—"}
                  </strong>
                </p>
                <p>
                  Статус:{" "}
                  <strong>
                    {mapStatus(pickString(selectedReturn.status), RETURN_STATUS_RU)}
                  </strong>
                </p>
                <p>
                  Причина: {pickString(selectedReturn.reason) ?? "—"}
                </p>
                {typeof selectedReturn.comment === "string" &&
                selectedReturn.comment.trim() !== "" ? (
                  <p>Комментарий: {selectedReturn.comment}</p>
                ) : null}

                <div className="admin-form-row">
                  <span className="admin-field-label">Действия</span>
                  <div className="admin-form-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {selectedReturn.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="admin-order-card__btn admin-order-card__btn--confirm"
                          disabled={busy}
                          onClick={() =>
                            void patchReturn(selectedReturnId!, {
                              status: "APPROVED",
                            })
                          }
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="admin-order-card__btn admin-order-card__btn--reject"
                          disabled={busy}
                          onClick={() =>
                            void patchReturn(selectedReturnId!, {
                              status: "REJECTED",
                            })
                          }
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    {selectedReturn.status === "APPROVED" && (
                      <>
                        <button
                          type="button"
                          className="admin-order-card__btn admin-order-card__btn--confirm"
                          disabled={busy}
                          onClick={() => {
                            const raw = window.prompt(
                              "Сумма возврата (сом, целое число)",
                              String(
                                (selectedReturn.total as number | undefined) ??
                                  ""
                              )
                            );
                            if (raw == null) return;
                            const n = Number(raw.trim());
                            if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
                              alert("Нужно целое число ≥ 0");
                              return;
                            }
                            void patchReturn(selectedReturnId!, {
                              status: "REFUNDED",
                              refundAmount: n,
                            });
                          }}
                        >
                          Возврат выполнен
                        </button>
                        <button
                          type="button"
                          className="admin-order-card__btn admin-order-card__btn--ship"
                          disabled={busy}
                          onClick={() =>
                            void patchReturn(selectedReturnId!, {
                              status: "RETURNED",
                            })
                          }
                        >
                          Товар возвращён
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
