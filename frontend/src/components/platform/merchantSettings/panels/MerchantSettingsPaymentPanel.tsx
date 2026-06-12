import type { ReactElement } from "react";
import { archa } from "../../../archa/archaUi";
import type { PlatformStoreSettingsDTO } from "../../../../services/platformApi";

type Props = {
  snap: PlatformStoreSettingsDTO | null;
  isPlatformAdmin: boolean;
  disabled?: boolean;
  finikKeyDraft: string;
  onFinikKeyDraftChange: (v: string) => void;
  finikAccountIdDraft: string;
  onFinikAccountIdDraftChange: (v: string) => void;
  finikSecretDraft: string;
  onFinikSecretDraftChange: (v: string) => void;
  finikSaving: boolean;
  finikErr: string | null;
  finikMsg: string | null;
  onSaveFinik: () => void;
  finikWebhookCopied: boolean;
  onCopyFinikWebhook: () => void;
};

export function MerchantSettingsPaymentPanel(props: Props): ReactElement {
  const ready = Boolean(props.snap?.finikReady);
  const platformManaged = props.snap?.finikPlatformManaged === true;

  return (
    <div className="mp-pay-status">
      <div
        className={`mp-pay-status__hero${ready ? " mp-pay-status__hero--ok" : " mp-pay-status__hero--warn"}`}
      >
        <p className="mp-pay-status__hero-title">
          {ready ? "Оплата подключена" : "Оплата не подключена"}
        </p>
        <p className="mp-pay-status__hero-sub">
          {ready
            ? platformManaged
              ? "Account ID подключён — покупатели могут оплачивать заказы онлайн через Finik."
              : "Покупатели могут оплачивать заказы онлайн через Finik."
            : platformManaged
              ? "Укажите Account ID Finik из личного кабинета Finik."
              : props.isPlatformAdmin
                ? "Укажите ключи Finik в разделе ниже или обратитесь в поддержку ARCHA."
                : "Для подключения онлайн-оплаты напишите в поддержку ARCHA — мы поможем настроить Finik."}
        </p>
      </div>

      <div className="mp-pay-status__grid">
        {!platformManaged ? (
          <div className="mp-pay-status__chip">
            API Key
            <strong>{props.snap?.finikHasApiKey ? "Сохранён" : "Не задан"}</strong>
          </div>
        ) : null}
        <div className="mp-pay-status__chip">
          Account ID
          <strong>{props.snap?.finikHasAccountId ? "Подключён" : "Не задан"}</strong>
        </div>
        <div className="mp-pay-status__chip">
          Webhook
          <strong>
            {props.snap?.finikWebhookUrl?.trim() ? "Настроен" : "Нет URL"}
          </strong>
        </div>
        <div className="mp-pay-status__chip">
          Статус
          <strong>{ready ? "Готов к оплате" : "Ожидает настройки"}</strong>
        </div>
      </div>

      {props.snap?.finikWebhookUrl?.trim() ? (
        <div className="mp-pay-status__webhook">
          <span className="mp-settings-field__label">Webhook URL</span>
          <code className="mp-pay-status__webhook-url">{props.snap.finikWebhookUrl}</code>
          <button
            type="button"
            className="mp-settings-btn-secondary mp-finik-webhook__copy"
            disabled={props.finikSaving}
            onClick={props.onCopyFinikWebhook}
          >
            {props.finikWebhookCopied ? "Скопировано" : "Скопировать"}
          </button>
        </div>
      ) : null}

      {platformManaged ? (
        <div className="mp-settings-panel" style={{ marginTop: "0.75rem" }}>
          <div className="mp-settings-field">
            <label
              htmlFor="platform-settings-finik-account"
              className="mp-settings-field__label"
            >
              Account ID Finik
            </label>
            <input
              id="platform-settings-finik-account"
              type="text"
              autoComplete="off"
              disabled={props.disabled || props.finikSaving}
              value={props.finikAccountIdDraft}
              onChange={(e) => props.onFinikAccountIdDraftChange(e.target.value)}
              placeholder={
                props.snap?.finikHasAccountId
                  ? "Новый ID (пусто = не менять)"
                  : "Вставьте Account ID"
              }
              className={`${archa.input} font-mono`}
            />
          </div>
          {props.finikErr ? (
            <p className="mp-settings-alert mp-settings-alert--error" role="alert">
              {props.finikErr}
            </p>
          ) : null}
          {props.finikMsg ? (
            <p className="text-sm text-[#86EFAC]" role="status">
              {props.finikMsg}
            </p>
          ) : null}
          <p className="mp-settings-field__hint">
            Сохранение — кнопкой внизу экрана «Сохранить Finik». API Key хранится на
            стороне ARCHA.
          </p>
        </div>
      ) : null}

      {!platformManaged && props.isPlatformAdmin ? (
        <details className="mp-pay-operator-details">
          <summary>Настройки Finik (оператор)</summary>
          <div className="mp-settings-panel" style={{ marginTop: "0.75rem" }}>
            <div className="mp-settings-field">
              <label htmlFor="platform-settings-finik-key" className="mp-settings-field__label">
                API Key Finik
              </label>
              <input
                id="platform-settings-finik-key"
                type="password"
                autoComplete="off"
                disabled={props.disabled || props.finikSaving}
                value={props.finikKeyDraft}
                onChange={(e) => props.onFinikKeyDraftChange(e.target.value)}
                placeholder={
                  props.snap?.finikHasApiKey
                    ? "Новый ключ (пусто = не менять)"
                    : "Вставьте API Key"
                }
                className={`${archa.input} font-mono`}
              />
            </div>
            <div className="mp-settings-field">
              <label
                htmlFor="platform-settings-finik-account-legacy"
                className="mp-settings-field__label"
              >
                Account ID Finik
              </label>
              <input
                id="platform-settings-finik-account-legacy"
                type="text"
                autoComplete="off"
                disabled={props.disabled || props.finikSaving}
                value={props.finikAccountIdDraft}
                onChange={(e) => props.onFinikAccountIdDraftChange(e.target.value)}
                placeholder={
                  props.snap?.finikHasAccountId
                    ? "Новый ID (пусто = не менять)"
                    : "Вставьте Account ID"
                }
                className={`${archa.input} font-mono`}
              />
            </div>
            <div className="mp-settings-field">
              <label
                htmlFor="platform-settings-finik-secret"
                className="mp-settings-field__label"
              >
                Secret (legacy, опционально)
              </label>
              <input
                id="platform-settings-finik-secret"
                type="password"
                autoComplete="off"
                disabled={props.disabled || props.finikSaving}
                value={props.finikSecretDraft}
                onChange={(e) => props.onFinikSecretDraftChange(e.target.value)}
                placeholder={
                  props.snap?.finikHasSecret
                    ? "Новый secret (пусто = не менять)"
                    : "Вставьте Secret"
                }
                className={`${archa.input} font-mono`}
              />
            </div>
            {props.finikErr ? (
              <p className="mp-settings-alert mp-settings-alert--error" role="alert">
                {props.finikErr}
              </p>
            ) : null}
            {props.finikMsg ? (
              <p className="text-sm text-[#86EFAC]" role="status">
                {props.finikMsg}
              </p>
            ) : null}
            <p className="mp-settings-field__hint">
              Сохранение — кнопкой внизу экрана «Сохранить Finik».
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
