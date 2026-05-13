import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminService,
  type AdminMembershipRow,
} from "../../services/admin.service";
import { useShop } from "../../context/ShopContext";
import {
  ALL_MERCHANT_PERMISSION_IDS,
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "../../permissions/merchantPermissions";

function roleBadgeClass(role: string): string {
  const u = role.toUpperCase();
  if (u === "OWNER") return "admin-role-badge admin-role-badge--owner";
  if (u === "ADMIN") return "admin-role-badge admin-role-badge--admin";
  return "admin-role-badge admin-role-badge--client";
}

const PERM_LABELS: { id: MerchantPermissionId; label: string }[] = [
  { id: MERCHANT_PERM.ordersManage, label: "Заказы" },
  { id: MERCHANT_PERM.catalogEdit, label: "Товары и категории" },
  { id: MERCHANT_PERM.designEdit, label: "Оформление витрины" },
  { id: MERCHANT_PERM.analyticsView, label: "Аналитика" },
  { id: MERCHANT_PERM.supportManage, label: "Поддержка" },
  { id: MERCHANT_PERM.settingsManage, label: "Оплата и промокоды" },
];

function effectiveAdminPermissions(stored: string[] | undefined): MerchantPermissionId[] {
  const list = stored ?? [];
  if (list.length === 0) return [...ALL_MERCHANT_PERMISSION_IDS];
  return ALL_MERCHANT_PERMISSION_IDS.filter((p) => list.includes(p));
}

export default function AdminUsersPage() {
  const { businessId } = useShop();
  const [rows, setRows] = useState<AdminMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [permBusyUserId, setPermBusyUserId] = useState<number | null>(null);
  const [permDraft, setPermDraft] = useState<Record<number, MerchantPermissionId[]>>({});

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
      const draft: Record<number, MerchantPermissionId[]> = {};
      for (const r of data) {
        if (String(r.role).toUpperCase() === "ADMIN") {
          draft[r.userId] = effectiveAdminPermissions(r.permissions);
        }
      }
      setPermDraft(draft);
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

  const togglePerm = useCallback((userId: number, perm: MerchantPermissionId) => {
    setPermDraft((prev) => {
      const cur = prev[userId] ?? [];
      const has = cur.includes(perm);
      const next = has ? cur.filter((p) => p !== perm) : [...cur, perm];
      return { ...prev, [userId]: next };
    });
  }, []);

  const savePermissions = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || businessId == null) return;
      setPermBusyUserId(targetUserId);
      try {
        const next = permDraft[targetUserId] ?? [];
        await adminService.updateMembershipPermissions({
          targetUserId,
          businessId,
          permissions: next,
        });
        await reload();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setPermBusyUserId(null);
      }
    },
    [businessId, canLoad, permDraft, reload],
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
          Назначайте или снимайте администраторов. Владельца изменить нельзя. Для
          администраторов можно ограничить доступ к разделам.
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
            const permBusy = permBusyUserId === r.userId;
            const draft = permDraft[r.userId] ?? effectiveAdminPermissions(r.permissions);
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
                  {rl === "ADMIN" ? (
                    <div style={{ marginTop: 12 }}>
                      <p className="admin-dash-page__muted" style={{ marginBottom: 8 }}>
                        Доступ к разделам
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px 14px",
                          alignItems: "center",
                        }}
                      >
                        {PERM_LABELS.map(({ id, label }) => (
                          <label
                            key={id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 14,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={draft.includes(id)}
                              onChange={() => togglePerm(r.userId, id)}
                              disabled={permBusy}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="admin-members-actions__btn"
                        style={{ marginTop: 10 }}
                        disabled={permBusy}
                        onClick={() => void savePermissions(r.userId)}
                      >
                        {permBusy ? "…" : "Сохранить права"}
                      </button>
                    </div>
                  ) : null}
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
