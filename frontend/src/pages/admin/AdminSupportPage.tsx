import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";

type Tab = "tickets" | "returns";

const TICKET_STATUS_OPTIONS = [
  "OPEN",
  "PENDING_CUSTOMER",
  "PENDING_MERCHANT",
  "RESOLVED",
  "CLOSED",
] as const;

const RETURN_STATUS_OPTIONS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REFUNDED",
  "RETURNED",
] as const;

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function ticketPreview(row: unknown): string {
  if (!row || typeof row !== "object") return "—";
  const messages = (row as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return "—";
  const m0 = messages[0];
  if (!m0 || typeof m0 !== "object") return "—";
  const t = (m0 as { text?: unknown }).text;
  const s = typeof t === "string" ? t.trim() : "";
  return s.length > 120 ? `${s.slice(0, 117)}…` : s || "—";
}

export default function AdminSupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<unknown[]>([]);
  const [returns, setReturns] = useState<unknown[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<unknown | null>(null);
  const [replyText, setReplyText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    const data = await adminService.listSupportTickets();
    setTickets(data);
  }, []);

  const loadReturns = useCallback(async () => {
    const data = await adminService.listReturnRequests();
    setReturns(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadTickets(), loadReturns()]);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [loadTickets, loadReturns]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedTicketId == null) {
      setTicketDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const d = await adminService.getSupportTicket(selectedTicketId);
        if (!cancelled) {
          setTicketDetail(d);
          const note =
            d &&
            typeof d === "object" &&
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
      setTicketDetail(d);
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
      setTicketDetail(d);
      await loadTickets();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
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

  const messages = useMemo(() => {
    if (!ticketDetail || typeof ticketDetail !== "object") return [];
    const m = (ticketDetail as { messages?: unknown }).messages;
    return Array.isArray(m) ? m : [];
  }, [ticketDetail]);

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Поддержка и возвраты</h1>
        <p className="admin-dash-page__subtitle">
          Тикеты и заявки на возврат по вашему магазину.
        </p>
      </header>

      <div className="admin-form-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "tickets" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("tickets")}
        >
          Тикеты
        </button>
        <button
          type="button"
          className={`admin-order-card__btn${tab === "returns" ? " admin-order-card__btn--accept" : ""}`}
          onClick={() => setTab("returns")}
        >
          Возвраты
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
          <div className="admin-support-list">
            {tickets.length === 0 && (
              <p className="admin-dash-page__muted">Нет тикетов</p>
            )}
            {tickets.map((row) => {
              if (!row || typeof row !== "object") return null;
              const id = (row as { id?: unknown }).id;
              if (typeof id !== "number") return null;
              const active = selectedTicketId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`admin-support-list__item${active ? " admin-support-list__item--active" : ""}`}
                  onClick={() => setSelectedTicketId(id)}
                >
                  <span className="admin-support-list__id">#{id}</span>
                  <span className="admin-support-list__meta">
                    заказ #
                    {String((row as { orderId?: unknown }).orderId ?? "—")} ·{" "}
                    {pickString((row as { status?: unknown }).status) ?? "—"}
                  </span>
                  <span className="admin-support-list__preview">
                    {ticketPreview(row)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="admin-support-detail">
            {selectedTicketId == null && (
              <p className="admin-dash-page__muted">Выберите тикет</p>
            )}
            {selectedTicketId != null && ticketDetail != null ? (
              <>
                <h2 className="admin-support-detail__title">
                  Тикет #{selectedTicketId}
                </h2>
                <p className="admin-dash-page__muted">
                  Заказ #
                  {(ticketDetail as { orderId?: number }).orderId ?? "—"}
                </p>

                <div className="admin-form-row">
                  <label className="admin-field-label" htmlFor="ticket-status">
                    Статус
                  </label>
                  <select
                    id="ticket-status"
                    className="admin-input"
                    value={pickString((ticketDetail as { status?: unknown }).status) ?? "OPEN"}
                    disabled={busy}
                    onChange={(e) =>
                      void saveTicketPatch({ status: e.target.value })
                    }
                  >
                    {TICKET_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-row">
                  <label className="admin-field-label" htmlFor="internal-note">
                    Внутренняя заметка (не видна клиенту)
                  </label>
                  <textarea
                    id="internal-note"
                    className="admin-input"
                    rows={3}
                    value={internalNote}
                    disabled={busy}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--confirm"
                    disabled={busy}
                    onClick={() =>
                      void saveTicketPatch({ internalNote: internalNote.trim() || null })
                    }
                  >
                    Сохранить заметку
                  </button>
                </div>

                <ul className="admin-support-timeline">
                  {messages.map((msg, idx) => {
                    if (!msg || typeof msg !== "object") return null;
                    const st = (msg as { senderType?: unknown }).senderType;
                    const text = (msg as { text?: unknown }).text;
                    const createdAt = (msg as { createdAt?: unknown }).createdAt;
                    return (
                      <li key={idx} className="admin-support-timeline__item">
                        <span className="admin-support-timeline__who">
                          {String(st ?? "—")}
                        </span>
                        <time className="admin-support-timeline__time">
                          {String(createdAt ?? "")}
                        </time>
                        <p className="admin-support-timeline__text">
                          {typeof text === "string" ? text : "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <div className="admin-form-row">
                  <label className="admin-field-label" htmlFor="reply-text">
                    Ответ клиенту
                  </label>
                  <textarea
                    id="reply-text"
                    className="admin-input"
                    rows={3}
                    value={replyText}
                    disabled={busy}
                    onChange={(e) => setReplyText(e.target.value)}
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
              </>
            ) : null}
          </div>
        </div>
      )}

      {!loading && tab === "returns" && (
        <div className="admin-support-grid">
          <div className="admin-support-list">
            {returns.length === 0 && (
              <p className="admin-dash-page__muted">Нет заявок</p>
            )}
            {returns.map((row) => {
              if (!row || typeof row !== "object") return null;
              const id = (row as { id?: unknown }).id;
              if (typeof id !== "number") return null;
              const active = selectedReturnId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`admin-support-list__item${active ? " admin-support-list__item--active" : ""}`}
                  onClick={() => setSelectedReturnId(id)}
                >
                  <span className="admin-support-list__id">#{id}</span>
                  <span className="admin-support-list__meta">
                    заказ #
                    {String((row as { orderId?: unknown }).orderId ?? "—")} ·{" "}
                    {pickString((row as { status?: unknown }).status) ?? "—"}
                  </span>
                  <span className="admin-support-list__preview">
                    {pickString((row as { reason?: unknown }).reason) ?? "—"}
                  </span>
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
                <h2 className="admin-support-detail__title">
                  Возврат #{selectedReturnId}
                </h2>
                <p>
                  Статус:{" "}
                  <strong>
                    {pickString(selectedReturn.status) ?? "—"}
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

                <p className="admin-dash-page__muted" style={{ marginTop: 16 }}>
                  Допустимые статусы: {RETURN_STATUS_OPTIONS.join(", ")}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
