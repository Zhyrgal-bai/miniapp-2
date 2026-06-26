import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { archa } from "../../archa/archaUi";
import { ArchaOverlay } from "../../ui/ArchaOverlay";
import type { PlatformStoreSettingsDTO } from "../../../services/platformApi";
import type { MerchantDeliverySettings } from "@repo-shared/merchantDeliverySettings";
import type { MerchantDeliveryProviderPolicy } from "../../../types/deliveryAdmin.types";
import type { StoreAvailabilitySettings } from "@repo-shared/storeAvailabilitySettings";
import type { MerchantStoreAddressDraft } from "../../../utils/nominatimGeocode";
import {
  MerchantSettingsStorePanel,
} from "./panels/MerchantSettingsStorePanel";
import { MerchantSettingsDeliveryPanel } from "./panels/MerchantSettingsDeliveryPanel";
import { MerchantSettingsSchedulePanel } from "./panels/MerchantSettingsSchedulePanel";
import { MerchantSettingsBotPanel } from "./panels/MerchantSettingsBotPanel";
import { MerchantSettingsPaymentPanel } from "./panels/MerchantSettingsPaymentPanel";
import { MerchantSettingsStorefrontPanel } from "./panels/MerchantSettingsStorefrontPanel";
import type { SchemaObject as MerchantSchemaObject } from "../../merchant/MerchantSettingsRenderer";
import "./merchantSettings.css";

export type MerchantSettingsView =
  | "hub"
  | "store"
  | "delivery"
  | "schedule"
  | "payment"
  | "bot"
  | "storefront";

type HubItem = {
  id: MerchantSettingsView;
  icon: string;
  title: string;
  desc: string;
  status?: "ok" | "warn";
  statusLabel?: string;
};

export type MerchantSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  okMsg: string | null;
  snap: PlatformStoreSettingsDTO | null;
  businessId: number | null;
  businessName: string;
  isPlatformAdmin: boolean;
  merchantTelegramId: number;
  settingsName: string;
  onSettingsNameChange: (v: string) => void;
  storeAddressDraft: MerchantStoreAddressDraft;
  onStoreAddressDraftChange: (v: MerchantStoreAddressDraft) => void;
  deliverySettingsDraft: MerchantDeliverySettings;
  onDeliverySettingsDraftChange: (v: MerchantDeliverySettings) => void;
  deliveryProviderPolicyDraft: MerchantDeliveryProviderPolicy;
  onDeliveryProviderPolicyDraftChange: (v: MerchantDeliveryProviderPolicy) => void;
  storeAvailabilityDraft: StoreAvailabilitySettings;
  onStoreAvailabilityDraftChange: (v: StoreAvailabilitySettings) => void;
  merchantConfigDraft: Record<string, unknown>;
  onMerchantConfigDraftChange: (v: Record<string, unknown>) => void;
  settingsNewToken: string;
  onSettingsNewTokenChange: (v: string) => void;
  botTokenSaving: boolean;
  onSaveBotToken: () => boolean | Promise<boolean>;
  botRecoveryRefresh: number;
  finikKeyDraft: string;
  onFinikKeyDraftChange: (v: string) => void;
  finikAccountIdDraft: string;
  onFinikAccountIdDraftChange: (v: string) => void;
  finikSecretDraft: string;
  onFinikSecretDraftChange: (v: string) => void;
  finikSaving: boolean;
  finikErr: string | null;
  finikMsg: string | null;
  onSaveFinik: () => void | Promise<void>;
  finikWebhookCopied: boolean;
  onCopyFinikWebhook: () => void | Promise<void>;
  onSubmit: (ev: FormEvent) => void | Promise<void>;
};

export function MerchantSettingsModal(props: MerchantSettingsModalProps): ReactElement {
  const [view, setView] = useState<MerchantSettingsView>("hub");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (props.open && !wasOpenRef.current) {
      setView("hub");
    }
    wasOpenRef.current = props.open;
  }, [props.open]);

  const closeAll = () => {
    setView("hub");
    props.onClose();
  };

  const goHub = () => setView("hub");

  const hubItems: HubItem[] = [
    {
      id: "store",
      icon: "🏪",
      title: "Магазин",
      desc: "Название, адрес и карта",
    },
    {
      id: "delivery",
      icon: "🚚",
      title: "Доставка",
      desc: "Режим, минимум заказа, тарифы",
    },
    {
      id: "schedule",
      icon: "🕐",
      title: "График работы",
      desc: "Часы работы и время доставки",
    },
    {
      id: "payment",
      icon: "💳",
      title: "Оплата",
      desc: props.snap?.finikReady ? "Finik подключён" : "Подключение Finik",
      status: props.snap?.finikReady ? "ok" : "warn",
      statusLabel: props.snap?.finikReady ? "OK" : "Нет",
    },
    {
      id: "bot",
      icon: "🤖",
      title: "Telegram Bot",
      desc: "Создание и подключение бота",
    },
    {
      id: "storefront",
      icon: "🎨",
      title: "Оформление витрины",
      desc: "Тема, цвета, баннер, превью",
    },
  ];

  const showSaveFooter =
    view !== "hub" &&
    view !== "storefront" &&
    view !== "payment" &&
    (view !== "bot" || props.isPlatformAdmin);

  /** Оператор: sticky footer. Мерчант (platform-managed): кнопка в панели оплаты. */
  const showPaymentSave = view === "payment" && props.isPlatformAdmin;

  const hasStickyFooter = showSaveFooter || showPaymentSave;
  const activeSection = view === "hub" ? null : hubItems.find((h) => h.id === view);

  return (
    <ArchaOverlay
      open={props.open}
      onClose={closeAll}
      variant="platform-modal"
      ariaLabel="Настройки магазина"
      panelClassName={
        view === "storefront"
          ? "mp-settings-dialog-shell mp-settings-dialog-shell--wide"
          : "mp-settings-dialog-shell"
      }
    >
      <div className="mp-settings-shell">
        <div className="mp-settings-header">
          <div className="mp-settings-header__lead">
            {view !== "hub" ? (
              <button
                type="button"
                className="mp-settings-section-nav__back"
                onClick={goHub}
                aria-label="Назад к разделам"
              >
                ←
              </button>
            ) : null}
            <div className="mp-settings-header__copy">
              <h2
                id="platform-settings-title"
                className="mp-settings-header__title"
              >
                {view === "hub" ? "Настройки магазина" : (activeSection?.title ?? "Настройки")}
              </h2>
              <p className="mp-settings-header__sub">
                {view === "hub" ? props.businessName : (activeSection?.desc ?? props.businessName)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={archa.btnIcon}
            onClick={closeAll}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {props.loading ? (
          <div className="mp-settings-shell__body">
            <p className="mp-muted text-sm">Загрузка…</p>
          </div>
        ) : props.error != null && props.snap == null ? (
          <div className="mp-settings-shell__body">
            <p className="mp-settings-alert mp-settings-alert--error" role="alert">
              {props.error}
            </p>
          </div>
        ) : (
          <form className="mp-settings-form" onSubmit={(e) => void props.onSubmit(e)}>
            <div
              className={`mp-settings-shell__body${hasStickyFooter ? " mp-settings-shell__body--pad-footer" : ""}`}
            >
              {props.snap?.pendingBotTokenChange && props.isPlatformAdmin ? (
                <p className="mp-settings-alert mp-settings-alert--amber" role="status">
                  Ожидается подтверждение администратором смены токена бота.
                </p>
              ) : null}

              {view === "hub" ? (
                <nav className="mp-settings-hub" aria-label="Разделы настроек">
                  {hubItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="mp-settings-hub__item"
                      onClick={() => setView(item.id)}
                    >
                      <span className="mp-settings-hub__icon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="mp-settings-hub__copy">
                        <span className="mp-settings-hub__title">{item.title}</span>
                        <span className="mp-settings-hub__desc">{item.desc}</span>
                      </span>
                      {item.status ? (
                        <span
                          className={`mp-settings-hub__status mp-settings-hub__status--${item.status}`}
                        >
                          {item.statusLabel}
                        </span>
                      ) : (
                        <span className="mp-settings-hub__chevron" aria-hidden>
                          ›
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              ) : null}

              {view === "store" ? (
                <>
                  <MerchantSettingsStorePanel
                    disabled={props.snap == null}
                    settingsName={props.settingsName}
                    onSettingsNameChange={props.onSettingsNameChange}
                    storeAddressDraft={props.storeAddressDraft}
                    onStoreAddressDraftChange={props.onStoreAddressDraftChange}
                    isPlatformAdmin={props.isPlatformAdmin}
                    businessType={props.snap?.businessType ?? ""}
                    merchantSettingsSchema={
                      props.snap?.merchantSettingsSchema as unknown as MerchantSchemaObject
                    }
                    merchantConfigDraft={props.merchantConfigDraft}
                    onMerchantConfigDraftChange={props.onMerchantConfigDraftChange}
                  />
                </>
              ) : null}

              {view === "delivery" ? (
                <>
                  <MerchantSettingsDeliveryPanel
                    deliverySettings={props.deliverySettingsDraft}
                    onDeliverySettingsChange={props.onDeliverySettingsDraftChange}
                    providerPolicy={props.deliveryProviderPolicyDraft}
                    onProviderPolicyChange={props.onDeliveryProviderPolicyDraftChange}
                    availability={props.storeAvailabilityDraft}
                    onAvailabilityChange={props.onStoreAvailabilityDraftChange}
                    disabled={props.snap == null}
                  />
                </>
              ) : null}

              {view === "schedule" ? (
                <>
                  <MerchantSettingsSchedulePanel
                    value={props.storeAvailabilityDraft}
                    businessType={props.snap?.businessType ?? ""}
                    onChange={props.onStoreAvailabilityDraftChange}
                  />
                </>
              ) : null}

              {view === "payment" ? (
                <>
                  <MerchantSettingsPaymentPanel
                    snap={props.snap}
                    isPlatformAdmin={props.isPlatformAdmin}
                    disabled={props.snap == null}
                    finikKeyDraft={props.finikKeyDraft}
                    onFinikKeyDraftChange={props.onFinikKeyDraftChange}
                    finikAccountIdDraft={props.finikAccountIdDraft}
                    onFinikAccountIdDraftChange={props.onFinikAccountIdDraftChange}
                    finikSecretDraft={props.finikSecretDraft}
                    onFinikSecretDraftChange={props.onFinikSecretDraftChange}
                    finikSaving={props.finikSaving}
                    finikErr={props.finikErr}
                    finikMsg={props.finikMsg}
                    onSaveFinik={() => void props.onSaveFinik()}
                    finikWebhookCopied={props.finikWebhookCopied}
                    onCopyFinikWebhook={() => void props.onCopyFinikWebhook()}
                  />
                </>
              ) : null}

              {view === "bot" ? (
                <>
                  <MerchantSettingsBotPanel
                    businessId={props.businessId ?? 0}
                    isPlatformAdmin={props.isPlatformAdmin}
                    disabled={props.snap == null}
                    tokenDraft={props.settingsNewToken}
                    onTokenDraftChange={props.onSettingsNewTokenChange}
                    saving={props.botTokenSaving || props.saving}
                    saveError={props.error}
                    saveOkMsg={props.okMsg}
                    onSaveToken={() => props.onSaveBotToken()}
                    refreshTrigger={props.botRecoveryRefresh}
                  />
                </>
              ) : null}

              {view === "storefront" && props.businessId != null ? (
                <>
                  <MerchantSettingsStorefrontPanel businessId={props.businessId} />
                </>
              ) : null}
            </div>

            {(showSaveFooter || showPaymentSave) && (
              <div className="mp-settings-shell__footer">
                {props.error ? (
                  <p className="mp-settings-alert mp-settings-alert--error" role="alert">
                    {props.error}
                  </p>
                ) : null}
                {props.okMsg ? (
                  <p className="text-sm text-[#86EFAC]" role="status">
                    {props.okMsg}
                  </p>
                ) : null}
                {showPaymentSave ? (
                  <button
                    type="button"
                    disabled={props.snap == null || props.finikSaving}
                    onClick={() => void props.onSaveFinik()}
                    className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-2"
                  >
                    {props.finikSaving ? "Сохранение…" : "Сохранить Finik"}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={props.snap == null || props.saving || props.loading}
                    className="mp-btn mp-btn--primary mp-btn--block mp-btn--lg mt-2"
                  >
                    {props.saving ? "Сохранение…" : "Сохранить настройки"}
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </ArchaOverlay>
  );
}
