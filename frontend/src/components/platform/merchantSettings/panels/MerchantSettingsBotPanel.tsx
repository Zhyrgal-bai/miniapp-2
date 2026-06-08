import { useCallback, useEffect, useState, type ReactElement } from "react";
import { archa } from "../../../archa/archaUi";
import {
  fetchMerchantBotStatus,
  postMerchantBotCheck,
  postMerchantBotReconnect,
  type MerchantBotRecoveryPayload,
} from "../../../../services/platformApi";
import { formatAdminApiError } from "../../../../utils/adminApiError";

type WizardStep = 1 | 2 | 3 | 4;

type Props = {
  businessId: number;
  isPlatformAdmin: boolean;
  disabled?: boolean;
  tokenDraft: string;
  onTokenDraftChange: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  saveOkMsg: string | null;
  onSaveToken: () => boolean | Promise<boolean>;
  refreshTrigger: number;
};

export function MerchantSettingsBotPanel(props: Props): ReactElement {
  const [step, setStep] = useState<WizardStep>(1);
  const [status, setStatus] = useState<MerchantBotRecoveryPayload | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [reconnectBusy, setReconnectBusy] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [checkOk, setCheckOk] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (props.businessId <= 0) return;
    try {
      const s = await fetchMerchantBotStatus(props.businessId);
      setStatus(s);
      if (s.status === "connected") setStep(4);
      else if (s.status === "not_configured") setStep(1);
      else setStep(3);
    } catch {
      setStatus(null);
    }
  }, [props.businessId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, props.refreshTrigger]);

  const runCheck = async () => {
    setCheckBusy(true);
    setCheckErr(null);
    setCheckOk(null);
    try {
      const s = await postMerchantBotCheck(props.businessId);
      setStatus(s);
      setCheckOk(
        s.status === "connected"
          ? "Бот подключён и отвечает."
          : "Проверка завершена — см. рекомендации ниже.",
      );
      if (s.status === "connected") setStep(4);
    } catch (e) {
      setCheckErr(formatAdminApiError(e));
    } finally {
      setCheckBusy(false);
    }
  };

  const runReconnect = async () => {
    setReconnectBusy(true);
    setCheckErr(null);
    setCheckOk(null);
    try {
      const s = await postMerchantBotReconnect(props.businessId);
      setStatus(s);
      setCheckOk(
        s.status === "connected"
          ? "Webhook переподключён, бот работает."
          : "Переподключение выполнено — при необходимости проверьте снова.",
      );
      if (s.status === "connected") setStep(4);
    } catch (e) {
      setCheckErr(formatAdminApiError(e));
    } finally {
      setReconnectBusy(false);
    }
  };

  const handleSaveAndContinue = async () => {
    const ok = await props.onSaveToken();
    if (ok) setStep(3);
  };

  const anyBusy = checkBusy || reconnectBusy || props.saving;
  const canReconnect =
    status != null &&
    !status.isBlocked &&
    status.status !== "not_configured" &&
    status.status !== "token_error";

  return (
    <div className="mp-bot-wizard">
      <div className="mp-bot-wizard__steps" aria-hidden>
        {([1, 2, 3, 4] as const).map((n) => (
          <span
            key={n}
            className={[
              "mp-bot-wizard__step-dot",
              step > n ? "mp-bot-wizard__step-dot--done" : "",
              step === n ? "mp-bot-wizard__step-dot--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>

      {step === 1 ? (
        <div className="mp-bot-wizard__card">
          <h3>Шаг 1 — Создайте бота</h3>
          <p>
            Откройте @BotFather в Telegram → «/newbot» → придумайте имя и username.
            Скопируйте токен — он понадобится на следующем шаге.
          </p>
          <div className="mp-bot-wizard__actions">
            <button type="button" className="mp-btn mp-btn--secondary" onClick={() => setStep(2)}>
              У меня есть токен →
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mp-bot-wizard__card">
          <h3>Шаг 2 — Вставьте токен</h3>
          <p>
            {props.isPlatformAdmin
              ? "Смена токена создаёт заявку для оператора. Текущий токен не показывается."
              : "Вставьте токен из @BotFather — мы проверим бота и подключим webhook."}
          </p>
          <input
            id="platform-settings-token"
            type="password"
            autoComplete="off"
            disabled={props.disabled || props.saving}
            value={props.tokenDraft}
            onChange={(e) => props.onTokenDraftChange(e.target.value)}
            placeholder="123456789:AA…"
            className={`${archa.input} font-mono`}
          />
          {props.saveError ? (
            <p className="mp-settings-alert mp-settings-alert--error mt-2" role="alert">
              {props.saveError}
            </p>
          ) : null}
          {props.saveOkMsg ? (
            <p className="text-sm text-[#86EFAC] mt-2" role="status">
              {props.saveOkMsg}
            </p>
          ) : null}
          <div className="mp-bot-wizard__actions">
            <button type="button" className="mp-btn mp-btn--ghost" onClick={() => setStep(1)}>
              ← Назад
            </button>
            <button
              type="button"
              className="mp-btn mp-btn--primary"
              disabled={props.disabled || anyBusy || props.tokenDraft.trim() === ""}
              onClick={() => void handleSaveAndContinue()}
            >
              {props.saving ? "Сохранение…" : "Сохранить и продолжить"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mp-bot-wizard__card">
          <h3>Шаг 3 — Проверка подключения</h3>
          <p>
            Нажмите «Проверить» — мы убедимся, что бот отвечает и webhook настроен.
          </p>
          {status ? (
            <>
              <p className="mp-settings-field__hint">
                Статус: <strong>{status.label}</strong>
                {status.botUsername ? ` (@${status.botUsername})` : ""}
              </p>
              {status.detail ? (
                <p className="mp-settings-field__hint">{status.detail}</p>
              ) : null}
            </>
          ) : null}
          {checkErr ? (
            <p className="mp-settings-alert mp-settings-alert--error" role="alert">
              {checkErr}
            </p>
          ) : null}
          {checkOk ? (
            <p className="text-sm text-[#86EFAC]" role="status">
              {checkOk}
            </p>
          ) : null}
          <div className="mp-bot-wizard__actions">
            <button type="button" className="mp-btn mp-btn--ghost" onClick={() => setStep(2)}>
              ← Назад
            </button>
            <button
              type="button"
              className="mp-btn mp-btn--primary"
              disabled={anyBusy || props.businessId <= 0}
              onClick={() => void runCheck()}
            >
              {checkBusy ? "Проверка…" : "Проверить подключение"}
            </button>
            <button
              type="button"
              className="mp-btn mp-btn--secondary"
              disabled={anyBusy || !canReconnect}
              onClick={() => void runReconnect()}
            >
              {reconnectBusy ? "Подключение…" : "Переподключить webhook"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mp-bot-wizard__card">
          <h3>Шаг 4 — Готово</h3>
          <p>
            Бот подключён. Покупатели могут открывать магазин через Mini App и получать
            уведомления.
          </p>
          {status?.botUsername ? (
            <p className="mp-settings-field__hint">@{status.botUsername}</p>
          ) : null}
          <div className="mp-bot-wizard__actions">
            <button type="button" className="mp-btn mp-btn--secondary" onClick={() => setStep(2)}>
              Сменить токен
            </button>
            <button
              type="button"
              className="mp-btn mp-btn--ghost"
              disabled={anyBusy}
              onClick={() => void runCheck()}
            >
              {checkBusy ? "Проверка…" : "Проверить снова"}
            </button>
            <button
              type="button"
              className="mp-btn mp-btn--secondary"
              disabled={anyBusy || !canReconnect}
              onClick={() => void runReconnect()}
            >
              {reconnectBusy ? "Подключение…" : "Переподключить webhook"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
