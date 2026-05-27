import { useCallback, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../store/toast.store";
import { formatAdminApiError } from "../../utils/adminApiError";
import {
  adminService,
  type AdminStaffRow,
  type StaffInvitePreview,
} from "../../services/admin.service";
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

function StaffInvitePanel(props: {
  businessId: number;
  onClose: () => void;
  onDone: () => void;
}): React.ReactElement {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<InviteRole>("ADMIN");
  const [preview, setPreview] = useState<StaffInvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUsername = username.trim().replace(/^@+/, "");

  const onFind = useCallback(async () => {
    if (normalizedUsername === "") {
      setError("Введите @username из Telegram");
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const p = await adminService.previewStaffInvite({
        businessId: props.businessId,
        username: normalizedUsername,
      });
      setPreview(p);
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(false);
    }
  }, [normalizedUsername, props.businessId]);

  const onInviteNow = useCallback(async () => {
    if (!preview?.canInviteNow) return;
    setBusy(true);
    setError(null);
    try {
      const result = await adminService.inviteStaffMember({
        businessId: props.businessId,
        username: normalizedUsername,
        role,
      });
      if (result.kind === "pending") {
        showSuccessToast(result.message);
      } else {
        showSuccessToast(`${preview.name} добавлен в команду`);
      }
      props.onDone();
      props.onClose();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(false);
    }
  }, [preview, normalizedUsername, props, role]);

  const onSavePending = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await adminService.createPendingStaffInvite({
        businessId: props.businessId,
        username: normalizedUsername,
        role,
      });
      showSuccessToast(out.message);
      props.onDone();
      props.onClose();
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(false);
    }
  }, [normalizedUsername, props, role]);

  const copyBotLink = useCallback(() => {
    const link = preview?.botLink;
    if (!link) return;
    void navigator.clipboard?.writeText(link).then(() => {
      showSuccessToast("Ссылка скопирована");
    });
  }, [preview?.botLink]);

  const needsBot = preview?.lookupStatus === "needs_bot_contact";

  return (
    <div className="admin-staff-invite">
      <div className="admin-staff-invite__head">
        <div>
          <h3 className="admin-staff-invite__title">Пригласить в команду</h3>
          <p className="admin-staff-invite__hint">
            Укажите @username. Если человек ещё не писал боту магазина, сохраните приглашение —
            доступ откроется после /start.
          </p>
        </div>
        <button
          type="button"
          className="admin-staff-invite__close"
          onClick={props.onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className="admin-staff-invite__form">
        <label className="admin-staff-invite__field">
          <span className="admin-staff-invite__label">Telegram @username</span>
          <input
            type="text"
            className="admin-input"
            placeholder="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setPreview(null);
              setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="admin-staff-invite__field">
          <span className="admin-staff-invite__label">Роль</span>
          <select
            className="admin-input"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
          >
            {INVITE_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-members-actions__btn"
          disabled={busy || normalizedUsername === ""}
          onClick={() => void onFind()}
        >
          {busy ? "Поиск…" : "Найти пользователя"}
        </button>
      </div>

      {preview ? (
        <div
          className={[
            "admin-staff-invite__preview",
            needsBot ? "admin-staff-invite__preview--pending" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="admin-staff-invite__preview-user">
            <PersonAvatar name={preview.name} photoUrl={preview.photoUrl} size="lg" />
            <div>
              <p className="admin-staff-invite__preview-name">{preview.name}</p>
              <p className="admin-staff-invite__preview-handle">{preview.username}</p>
              {preview.alreadyStaff ? (
                <span className="admin-staff-invite__badge admin-staff-invite__badge--warn">
                  Уже в команде
                </span>
              ) : preview.canInviteNow ? (
                <span className="admin-staff-invite__badge admin-staff-invite__badge--ok">
                  Можно добавить сейчас
                </span>
              ) : preview.hasPendingInvite ? (
                <span className="admin-staff-invite__badge">Приглашение уже сохранено</span>
              ) : null}
            </div>
          </div>

          {needsBot && !preview.alreadyStaff ? (
            <div className="admin-staff-invite__steps">
              <p className="admin-staff-invite__steps-title">
                Пользователь ещё не связан с ботом магазина
              </p>
              <ol className="admin-staff-invite__steps-list">
                <li>Попросите открыть бота магазина и нажать «Старт»</li>
                <li>Или открыть витрину из этого бота хотя бы один раз</li>
                <li>После этого нажмите «Найти» снова или сохраните приглашение</li>
              </ol>
              <div className="admin-staff-invite__cta-row">
                {preview.botLink ? (
                  <>
                    <a
                      href={preview.botLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-members-actions__btn admin-members-actions__btn--promote"
                    >
                      Открыть бота
                    </a>
                    <button
                      type="button"
                      className="admin-members-actions__btn"
                      onClick={copyBotLink}
                    >
                      Скопировать ссылку
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="admin-members-actions__btn admin-members-actions__btn--promote"
                  disabled={busy}
                  onClick={() => void onSavePending()}
                >
                  {busy ? "Сохранение…" : "Сохранить приглашение"}
                </button>
              </div>
            </div>
          ) : null}

          {preview.canInviteNow && !preview.alreadyStaff ? (
            <button
              type="button"
              className="admin-members-actions__btn admin-members-actions__btn--promote admin-staff-invite__confirm"
              disabled={busy}
              onClick={() => void onInviteNow()}
            >
              {busy ? "Добавление…" : `Добавить как ${mapStatus(role, STAFF_ROLE_RU)}`}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="admin-dash-page__alert admin-staff-invite__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
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
      const msg = formatAdminApiError(e);
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, canLoad]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onRemove = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || businessId == null) return;
      if (!window.confirm("Удалить сотрудника из команды?")) return;
      setBusyUserId(targetUserId);
      try {
        await adminService.removeStaffMember({ targetUserId, businessId });
        showSuccessToast("Сотрудник удалён из команды");
        await reload();
      } catch (e) {
        showErrorToast(formatAdminApiError(e));
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
        showSuccessToast("Роль обновлена");
        await reload();
      } catch (e) {
        showErrorToast(formatAdminApiError(e));
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
        showSuccessToast("Права сохранены");
        await reload();
      } catch (e) {
        showErrorToast(formatAdminApiError(e));
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
        <div className="admin-dash-page__head-row">
          <div>
            <h2 className="admin-dash-page__title">{title}</h2>
            <p className="admin-dash-page__subtitle">
              Назначайте администраторов, менеджеров и поддержку. Покупатели здесь не отображаются.
            </p>
          </div>
          <button
            type="button"
            className="admin-members-actions__btn admin-members-actions__btn--promote"
            onClick={() => setInviteOpen(true)}
          >
            + Пригласить
          </button>
        </div>
      </div>

      {inviteOpen && businessId != null ? (
        <StaffInvitePanel
          businessId={businessId}
          onClose={() => setInviteOpen(false)}
          onDone={() => void reload()}
        />
      ) : null}

      {loading ? (
        <p className="admin-dash-page__muted" role="status">
          Загрузка команды…
        </p>
      ) : null}

      {error != null && !loading ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && error == null ? (
        <div className="admin-team-grid">
          {rows.length === 0 ? (
            <p className="admin-dash-page__muted">В команде пока только владелец.</p>
          ) : null}
          {rows.map((r) => {
            const rl = String(r.role).toUpperCase();
            const busy = busyUserId === r.userId;
            const permBusy = permBusyUserId === r.userId;
            const draft = permDraft[r.userId] ?? effectiveAdminPermissions(r.permissions);
            const canEditPerms = rl === "ADMIN" || rl === "MANAGER";
            return (
              <article key={`${r.staffId}-${businessId}`} className="admin-team-card">
                <div className="admin-team-card__top">
                  <PersonAvatar name={r.name} photoUrl={r.photoUrl} size="lg" />
                  <div className="admin-team-card__identity">
                    <h3 className="admin-team-card__name">{r.name}</h3>
                    {r.username ? (
                      <p className="admin-team-card__username">{r.username}</p>
                    ) : (
                      <p className="admin-team-card__username admin-team-card__username--muted">
                        Без username
                      </p>
                    )}
                    <span className={roleBadgeClass(rl)}>{mapStatus(rl, STAFF_ROLE_RU)}</span>
                  </div>
                </div>

                {canEditPerms ? (
                  <div className="admin-team-card__perms">
                    <p className="admin-team-card__perms-title">Доступ к разделам</p>
                    <div className="admin-team-card__perm-grid">
                      {PERM_LABELS.map(({ id, label }) => (
                        <label key={id} className="admin-team-card__perm">
                          <input
                            type="checkbox"
                            checked={draft.includes(id)}
                            onChange={() => togglePerm(r.userId, id)}
                            disabled={permBusy}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="admin-members-actions__btn"
                      disabled={permBusy}
                      onClick={() => void savePermissions(r.userId)}
                    >
                      {permBusy ? "Сохранение…" : "Сохранить права"}
                    </button>
                  </div>
                ) : null}

                {rl !== "OWNER" ? (
                  <div className="admin-team-card__actions">
                    <select
                      className="admin-input admin-team-card__role-select"
                      value={rl === "ADMIN" || rl === "MANAGER" || rl === "SUPPORT" ? rl : "ADMIN"}
                      disabled={busy}
                      onChange={(e) =>
                        void onRoleChange(r.userId, e.target.value as InviteRole)
                      }
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
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
