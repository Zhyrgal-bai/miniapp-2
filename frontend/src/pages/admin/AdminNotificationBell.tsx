import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type MerchantNotificationItem,
} from "../../services/admin.service";

type Props = {
  onNavigate?: (href: string) => void;
};

export function AdminNotificationBell({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<MerchantNotificationItem[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await adminService.getNotifications(15);
      setUnread(r.unreadCount);
      setItems(r.items);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const toggle = () => setOpen((v) => !v);

  const markAll = async () => {
    try {
      await adminService.markAllNotificationsRead();
      setUnread(0);
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="admin-dash__notif-wrap">
      <button
        type="button"
        className="admin-dash__notif-btn"
        aria-label="Уведомления"
        onClick={toggle}
      >
        🔔
        {unread > 0 ? (
          <span className="admin-dash__notif-badge">{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="admin-ops-notif-panel" role="dialog" aria-label="Уведомления">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <p className="admin-ops-notif-panel__title">Центр уведомлений</p>
            {unread > 0 ? (
              <button type="button" className="admin-dash__exit" onClick={() => void markAll()}>
                Прочитать все
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="admin-dash-page__muted">Нет уведомлений</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`admin-ops-notif-item${n.readAt == null ? " admin-ops-notif-item--unread" : ""}`}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (n.href) {
                    onNavigate?.(n.href);
                    window.location.hash = n.href.replace(/^#/, "");
                  }
                  setOpen(false);
                }}
              >
                <div>{n.title}</div>
                {n.body ? (
                  <div className="admin-dash-page__muted" style={{ fontSize: 12 }}>
                    {n.body}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
