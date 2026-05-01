import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminService,
  type AdminMembershipRow,
} from "../../services/admin.service";
import { useShop } from "../../context/ShopContext";

function roleBadgeClass(role: string): string {
  const u = role.toUpperCase();
  if (u === "OWNER") return "admin-role-badge admin-role-badge--owner";
  if (u === "ADMIN") return "admin-role-badge admin-role-badge--admin";
  return "admin-role-badge admin-role-badge--client";
}

export default function AdminUsersPage() {
  const { businessId } = useShop();
  const [rows, setRows] = useState<AdminMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const canLoad =
    typeof businessId === "number" &&
    Number.isInteger(businessId) &&
    businessId > 0;

  const reload = useCallback(async () => {
    if (!canLoad || businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getMembershipRows(businessId);
      setRows(data);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось загрузить пользователей";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, canLoad]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPromote = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || businessId == null) return;
      setBusyUserId(targetUserId);
      try {
        await adminService.updateMembershipRole({
          targetUserId,
          businessId,
          role: "ADMIN",
        });
        await reload();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusyUserId(null);
      }
    },
    [businessId, canLoad, reload],
  );

  const onDemote = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || businessId == null) return;
      setBusyUserId(targetUserId);
      try {
        await adminService.updateMembershipRole({
          targetUserId,
          businessId,
          role: "CLIENT",
        });
        await reload();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusyUserId(null);
      }
    },
    [businessId, canLoad, reload],
  );

  const title = useMemo(() => {
    return "Участники магазина";
  }, []);

  if (!canLoad) {
    return (
      <div className="admin-dash-page__head">
        <h2 className="admin-dash-page__title">{title}</h2>
        <p className="admin-dash-page__subtitle">
          Откройте приложение из витрины с параметром{" "}
          <code style={{ opacity: 0.85 }}>?shop=id</code>.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="admin-dash-page__head">
        <h2 className="admin-dash-page__title">{title}</h2>
        <p className="admin-dash-page__subtitle">
          Назначайте или снимайте администраторов. Владельца изменить нельзя.
        </p>
      </div>

      {loading && (
        <p className="admin-dash-page__muted" role="status">
          Загрузка...
        </p>
      )}
      {error != null && !loading && (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {!loading && error == null && (
        <div className="admin-members-list">
          {rows.map((r) => {
            const rl = String(r.role).toUpperCase();
            const busy = busyUserId === r.userId;
            return (
              <div key={`${r.userId}-${businessId}`} className="admin-members-row">
                <div className="admin-members-row__main">
                  <p className="admin-members-row__name">
                    {r.name?.trim()
                      ? r.name.trim()
                      : `Telegram ${r.telegramId}`}
                  </p>
                  <p className="admin-members-row__meta">
                    id {r.telegramId}
                    {" · "}user #{r.userId}
                  </p>
                  <p style={{ margin: "10px 0 0" }}>
                    <span className={roleBadgeClass(rl)}>{rl}</span>
                  </p>
                </div>
                <div className="admin-members-actions">
                  {rl === "OWNER" ? null : rl === "CLIENT" ? (
                    <button
                      type="button"
                      className="admin-members-actions__btn admin-members-actions__btn--promote"
                      disabled={busy}
                      onClick={() => void onPromote(r.userId)}
                    >
                      {busy ? "…" : "Сделать админом"}
                    </button>
                  ) : rl === "ADMIN" ? (
                    <button
                      type="button"
                      className="admin-members-actions__btn admin-members-actions__btn--demote"
                      disabled={busy}
                      onClick={() => void onDemote(r.userId)}
                    >
                      {busy ? "…" : "Убрать админа"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
