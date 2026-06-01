import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMerchantBotStatus,
  postMerchantBotCheck,
  postMerchantBotReconnect,
  type MerchantBotRecoveryPayload,
  type MerchantBotStatusCode,
} from "../../services/platformApi";
import { formatAdminApiError } from "../../utils/adminApiError";

const STATUS_CLASS: Record<MerchantBotStatusCode, string> = {
  connected: "mp-bot-recovery__badge--ok",
  webhook_error: "mp-bot-recovery__badge--warn",
  token_error: "mp-bot-recovery__badge--err",
  not_configured: "mp-bot-recovery__badge--muted",
};

type Props = {
  businessId: number;
  /** Увеличьте после смены токена, чтобы перезагрузить статус. */
  refreshTrigger?: number;
  onStatusChange?: (status: MerchantBotRecoveryPayload) => void;
  onOpenSettings?: () => void;
};

export function MerchantBotRecovery({
  businessId,
  refreshTrigger = 0,
  onStatusChange,
  onOpenSettings,
}: Props) {
  const [status, setStatus] = useState<MerchantBotRecoveryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"check" | "reconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const notifyParent = useCallback((s: MerchantBotRecoveryPayload) => {
    onStatusChangeRef.current?.(s);
  }, []);

  const loadStatus = useCallback(async () => {
    if (businessId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const s = await fetchMerchantBotStatus(businessId);
      setStatus(s);
    } catch (e) {
      setStatus(null);
      setError(formatAdminApiError(e));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshTrigger]);

  const runCheck = async () => {
    setBusy("check");
    setError(null);
    setSuccess(null);
    try {
      const s = await postMerchantBotCheck(businessId);
      setStatus(s);
      notifyParent(s);
      setSuccess(
        s.status === "connected"
          ? "Бот отвечает, webhook в порядке."
          : "Проверка завершена — см. статус и рекомендацию.",
      );
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const runReconnect = async () => {
    setBusy("reconnect");
    setError(null);
    setSuccess(null);
    try {
      const s = await postMerchantBotReconnect(businessId);
      setStatus(s);
      notifyParent(s);
      setSuccess(
        s.status === "connected"
          ? "Webhook переподключён, бот работает."
          : "Переподключение выполнено — при необходимости проверьте снова.",
      );
    } catch (e) {
      setError(formatAdminApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const anyBusy = busy != null;
  const canReconnect =
    status != null &&
    !status.isBlocked &&
    status.status !== "not_configured" &&
    status.status !== "token_error";

  return (
    <section className="mp-v2-section" aria-label="Статус Telegram-бота">
      <h2 className="mp-v2-section-title">Telegram-бот</h2>
      <div className="mp-v2-card mp-bot-recovery">
        {loading ? (
          <p className="mp-muted text-sm">Проверяем бота…</p>
        ) : status != null ? (
          <>
            <div className="mp-bot-recovery__row">
              <span
                className={`mp-bot-recovery__badge ${STATUS_CLASS[status.status]}`}
              >
                {status.label}
              </span>
              {status.botUsername ? (
                <span className="mp-bot-recovery__user">@{status.botUsername}</span>
              ) : null}
            </div>

            {status.detail ? (
              <p className="mp-bot-recovery__detail" role="status">
                {status.detail}
              </p>
            ) : null}

            <ul className="mp-bot-recovery__meta">
              <li>
                Витрина в приложении:{" "}
                {status.isActive ? "включена" : "выключена"}
                {!status.isActive && status.status === "connected" ? (
                  <span className="mp-bot-recovery__meta-hint">
                    {" "}
                    (подписка или настройки магазина)
                  </span>
                ) : null}
              </li>
              <li>
                Процесс сервера: {status.botInMemory ? "бот в памяти" : "не загружен"}
              </li>
              {status.webhookUrl ? (
                <li className="mp-bot-recovery__webhook">
                  Webhook: <code>{status.webhookUrl}</code>
                </li>
              ) : null}
            </ul>

            {status.isBlocked ? (
              <p className="mp-bot-recovery__blocked" role="alert">
                Магазин заблокирован платформой — восстановление бота недоступно.
              </p>
            ) : null}

            <div className="mp-bot-recovery__actions">
              <button
                type="button"
                className="mp-btn mp-btn--secondary mp-btn--sm"
                disabled={anyBusy}
                onClick={() => void runCheck()}
              >
                {busy === "check" ? "Проверка…" : "Проверить бота"}
              </button>
              <button
                type="button"
                className="mp-btn mp-btn--primary mp-btn--sm"
                disabled={anyBusy || !canReconnect}
                title={
                  !canReconnect
                    ? "Сначала исправьте токен в настройках"
                    : undefined
                }
                onClick={() => void runReconnect()}
              >
                {busy === "reconnect"
                  ? "Подключение…"
                  : "Переподключить webhook"}
              </button>
              <button
                type="button"
                className="mp-btn mp-btn--secondary mp-btn--sm"
                disabled={anyBusy}
                onClick={() => void runCheck()}
              >
                Повторить проверку
              </button>
            </div>

            {status.status === "not_configured" ||
            status.status === "token_error" ? (
              onOpenSettings != null ? (
                <button
                  type="button"
                  className="mp-bot-recovery__settings-link"
                  onClick={onOpenSettings}
                >
                  Открыть настройки токена →
                </button>
              ) : null
            ) : null}
          </>
        ) : (
          <p className="mp-bot-recovery__detail" role="alert">
            {error ?? "Не удалось загрузить статус бота"}
          </p>
        )}

        {error && status != null ? (
          <p className="mp-bot-recovery__err" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mp-bot-recovery__ok" role="status">
            {success}
          </p>
        ) : null}
      </div>
    </section>
  );
}
