import { useCallback, useEffect, useMemo, useState } from "react";
import { showErrorToast } from "../../store/toast.store";
import { adminService, type AdminStaffRow } from "../../services/admin.service";
import { useShop } from "../../context/ShopContext";
import {
  ALL_MERCHANT_PERMISSION_IDS,
  MERCHANT_PERM,
  type MerchantPermissionId,
} from "../../permissions/merchantPermissions";
import { mapStatus, STAFF_ROLE_RU } from "../../i18n/statusMaps";
import { PersonAvatar } from "../../components/support/PersonAvatar";

type InviteRole = "ADMIN" | "MANAGER" | "SUPPORT";

function roleBadgeClass(role: string): string {
  const u = role.toUpperCase();
  if (u === "OWNER") return "admin-role-badge admin-role-badge--owner";
  if (u === "ADMIN") return "admin-role-badge admin-role-badge--admin";
  if (u === "MANAGER") return "admin-role-badge admin-role-badge--manager";
  if (u === "SUPPORT") return "admin-role-badge admin-role-badge--support";
  return "admin-role-badge";
}

const PERM_LABELS: { id: MerchantPermissionId; label: string }[] = [
  { id: MERCHANT_PERM.ordersManage, label: "Заказы" },
  { id: MERCHANT_PERM.catalogEdit, label: "Товары и категории" },
  { id: MERCHANT_PERM.designEdit, label: "Оформление витрины" },
  { id: MERCHANT_PERM.analyticsView, label: "Аналитика" },
  { id: MERCHANT_PERM.supportManage, label: "Поддержка" },
  { id: MERCHANT_PERM.settingsManage, label: "Оплата и промокоды" },
];

const INVITE_ROLES: { id: InviteRole; label: string }[] = [
  { id: "ADMIN", label: "Администратор" },
  { id: "MANAGER", label: "Менеджер" },
  { id: "SUPPORT", label: "Поддержка" },
];

function effectiveAdminPermissions(stored: string[] | undefined): MerchantPermissionId[] {
  const list = stored ?? [];
  if (list.length === 0) return [...ALL_MERCHANT_PERMISSION_IDS];
  return ALL_MERCHANT_PERMISSION_IDS.filter((p) => list.includes(p));
}

export default function AdminUsersPage() {
  const { businessId } = useShop();
  const [rows, setRows] = useState<AdminStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [permBusyUserId, setPermBusyUserId] = useState<number | null>(null);
  const [permDraft, setPermDraft] = useState<Record<number, MerchantPermissionId[]>>({});

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("ADMIN");
  const [invitePreview, setInvitePreview] = useState<{
    name: string;
    username: string;
    alreadyStaff: boolean;
  } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const canLoad =
    typeof businessId === "number" &&
    Number.isInteger(businessId) &&
    businessId > 0;

  const reload = useCallback(async () => {
    if (!canLoad || businessId == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getStaffRows(businessId);
      setRows(data);
      const draft: Record<number, MerchantPermissionId[]> = {};
      for (const r of data) {
        const rl = String(r.role).toUpperCase();
        if (rl === "ADMIN" || rl === "MANAGER") {
          draft[r.userId] = effectiveAdminPermissions(r.permissions);
        }
      }
      setPermDraft(draft);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось загрузить команду";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, canLoad]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPreviewInvite = useCallback(async () => {
    if (!canLoad || businessId == null) return;
    setInviteBusy(true);
    setInviteError(null);
    setInvitePreview(null);
    try {
      const preview = await adminService.previewStaffInvite({
        businessId,
        username: inviteUsername,
      });
      setInvitePreview(preview);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Не удалось найти пользователя");
    } finally {
      setInviteBusy(false);
    }
  }, [businessId, canLoad, inviteUsername]);

  const onConfirmInvite = useCallback(async () => {
    if (!canLoad || businessId == null || invitePreview?.alreadyStaff) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await adminService.inviteStaffMember({
        businessId,
        username: inviteUsername,
        role: inviteRole,
      });
      setInviteOpen(false);
      setInviteUsername("");
      setInvitePreview(null);
      await reload();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Ошибка приглашения");
    } finally {
      setInviteBusy(false);
    }
  }, [businessId, canLoad, invitePreview, inviteRole, inviteUsername, reload]);

  const onRemove = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || businessId == null) return;
      if (!window.confirm("Удалить сотрудника из команды?")) return;
      setBusyUserId(targetUserId);
      try {
        await adminService.removeStaffMember({ targetUserId, businessId });
        await reload();
      } catch (e) {
        showErrorToast(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusyUserId(null);
      }
    },
    [businessId, canLoad, reload],
  );

  const onRoleChange = useCallback(
    async (targetUserId: number, role: InviteRole) => {
      if (!canLoad || businessId == null) return;
      setBusyUserId(targetUserId);
      try {
        await adminService.updateStaffRole({ targetUserId, businessId, role });
        await reload();
      } catch (e) {
        showErrorToast(e instanceof Error ? e.message : "Ошибка");
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
        await adminService.updateStaffPermissions({
          targetUserId,
          businessId,
          permissions: next,
        });
        await reload();
      } catch (e) {
        showErrorToast(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setPermBusyUserId(null);
      }
    },
    [businessId, canLoad, permDraft, reload],
  );

  const title = useMemo(() => "Команда магазина", []);

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 className="admin-dash-page__title">{title}</h2>
            <p className="admin-dash-page__subtitle">
              Только сотрудники магазина. Покупатели здесь не отображаются.
              Аудитория и активность — в разделе «Операции».
            </p>
          </div>
          <button
            type="button"
            className="admin-members-actions__btn admin-members-actions__btn--promote"
            onClick={() => {
              setInviteOpen(true);
              setInviteError(null);
              setInvitePreview(null);
            }}
          >
            Добавить администратора
          </button>
        </div>
      </div>

      {inviteOpen ? (
        <div className="admin-dash-card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>Приглашение в команду</h3>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            Telegram @username
            <input
              type="text"
              className="admin-input"
              placeholder="@username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
            Роль
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InviteRole)}
              style={{ display: "block", width: "100%", marginTop: 6 }}
            >
              {INVITE_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="admin-members-actions__btn"
              disabled={inviteBusy || inviteUsername.trim() === ""}
              onClick={() => void onPreviewInvite()}
            >
              {inviteBusy ? "…" : "Найти"}
            </button>
            {invitePreview && !invitePreview.alreadyStaff ? (
              <button
                type="button"
                className="admin-members-actions__btn admin-members-actions__btn--promote"
                disabled={inviteBusy}
                onClick={() => void onConfirmInvite()}
              >
                Подтвердить
              </button>
            ) : null}
            <button
              type="button"
              className="admin-members-actions__btn admin-members-actions__btn--demote"
              onClick={() => setInviteOpen(false)}
            >
              Отмена
            </button>
          </div>
          {invitePreview ? (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <PersonAvatar name={invitePreview.name} size="md" />
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{invitePreview.name}</p>
                <p className="admin-dash-page__muted" style={{ margin: "4px 0 0" }}>
                  {invitePreview.username}
                </p>
                {invitePreview.alreadyStaff ? (
                  <p style={{ margin: "6px 0 0", color: "var(--sf-color-warning, #c90)" }}>
                    Уже в команде
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {inviteError ? (
            <p className="admin-dash-page__alert" style={{ marginTop: 12 }} role="alert">
              {inviteError}
            </p>
          ) : null}
        </div>
      ) : null}

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
            const canEditPerms = rl === "ADMIN" || rl === "MANAGER";
            return (
              <div key={`${r.staffId}-${businessId}`} className="admin-members-row">
                <div className="admin-members-row__main">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <PersonAvatar
                      name={r.name}
                      photoUrl={r.photoUrl}
                      size="lg"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="admin-members-row__name">{r.name}</p>
                      {r.username ? (
                        <p className="admin-members-row__meta">{r.username}</p>
                      ) : null}
                      <p style={{ margin: "10px 0 0" }}>
                        <span className={roleBadgeClass(rl)}>
                          {mapStatus(rl, STAFF_ROLE_RU)}
                        </span>
                      </p>
                    </div>
                  </div>
                  {canEditPerms ? (
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
                  {rl === "OWNER" ? null : (
                    <>
                      <select
                        value={rl === "ADMIN" || rl === "MANAGER" || rl === "SUPPORT" ? rl : "ADMIN"}
                        disabled={busy}
                        onChange={(e) =>
                          void onRoleChange(r.userId, e.target.value as InviteRole)
                        }
                        style={{ marginBottom: 8, maxWidth: "100%" }}
                      >
                        {INVITE_ROLES.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-members-actions__btn admin-members-actions__btn--demote"
                        disabled={busy}
                        onClick={() => void onRemove(r.userId)}
                      >
                        {busy ? "…" : "Удалить"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
