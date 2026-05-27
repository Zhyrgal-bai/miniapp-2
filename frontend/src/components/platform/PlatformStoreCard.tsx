import { useState } from "react";
import { motion } from "framer-motion";
import type { PlatformMyBusinessDTO } from "../../services/platformApi";
import {
  botRunBadge,
  formatDaysRemaining,
  formatRuDateShort,
  miniAppOpenUrl,
  storeInitials,
  subscriptionBadge,
  webhookBadge,
  webhookUrlLine,
} from "../../pages/platform/platformUi";

export type PlatformStoreCardProps = {
  business: PlatformMyBusinessDTO;
  index: number;
  isPlatformAdmin: boolean;
  settingsBusinessId: number | null;
  settingsLoading: boolean;
  settingsSaving: boolean;
  toggleBusy: boolean;
  webhookBusy: boolean;
  deleteBusy: boolean;
  extendBusy: boolean;
  unblockBusy: boolean;
  onOpenStore: (b: PlatformMyBusinessDTO) => void;
  onOpenSettings: (b: PlatformMyBusinessDTO) => void;
  onCopyMiniApp: (b: PlatformMyBusinessDTO) => void;
  onToggleBot: (b: PlatformMyBusinessDTO) => void;
  onCheckWebhook: (b: PlatformMyBusinessDTO) => void;
  onDeleteShop: (b: PlatformMyBusinessDTO) => void;
  onExtendSubscription: (b: PlatformMyBusinessDTO, days: 30 | 90) => void;
  onUnblockShop: (b: PlatformMyBusinessDTO) => void;
};

export function PlatformStoreCard({
  business: b,
  index,
  isPlatformAdmin,
  settingsBusinessId,
  settingsLoading,
  settingsSaving,
  toggleBusy,
  webhookBusy,
  deleteBusy,
  extendBusy,
  unblockBusy,
  onOpenStore,
  onOpenSettings,
  onCopyMiniApp,
  onToggleBot,
  onCheckWebhook,
  onDeleteShop,
  onExtendSubscription,
  onUnblockShop,
}: PlatformStoreCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const runBadge = botRunBadge(b);
  const subBadge = subscriptionBadge(b.status);
  const whBadge = webhookBadge(b.webhookStatus);
  const subLocked = !b.subscriptionActive;
  const trialEndLabel = formatRuDateShort(b.trialEndsAt);
  const subEndLabel = formatRuDateShort(b.subscriptionEndsAt);
  const trialRem = formatDaysRemaining(b.trialEndsAt);
  const subRem = formatDaysRemaining(b.subscriptionEndsAt);

  const glowClass = b.isBlocked
    ? "mp-v2-card--glow-danger"
    : subLocked
      ? "mp-v2-card--glow-warn"
      : "mp-v2-card--glow-ok";

  const settingsBusy =
    settingsBusinessId === b.id && (settingsLoading || settingsSaving);

  return (
    <motion.li
      className={`mp-v2-card ${glowClass}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mp-v2-store-head">
        <div className="mp-v2-store-avatar" aria-hidden>
          <span>{storeInitials(b.name)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mp-v2-store-name">{b.name}</h2>
          <p className="mp-v2-store-type">
            {isPlatformAdmin ? `ID ${b.id}` : "Ваш магазин"}
          </p>
          <div className="mp-v2-badge-row">
            <span className={runBadge.className}>{runBadge.label}</span>
            <span className={subBadge.className}>{subBadge.label}</span>
            {isPlatformAdmin ? (
              <span className={whBadge.className}>{whBadge.label}</span>
            ) : null}
          </div>
        </div>
      </div>

      {!isPlatformAdmin ? (
        <div className="mp-v2-sub-hint">
          {trialEndLabel != null ? (
            <p>
              Пробный период до {trialEndLabel}
              {trialRem != null ? ` · ${trialRem}` : ""}
            </p>
          ) : null}
          {subEndLabel != null ? (
            <p>
              Подписка до {subEndLabel}
              {subRem != null ? ` · ${subRem}` : ""}
            </p>
          ) : null}
          {trialEndLabel == null && subEndLabel == null ? (
            <p>Сроки подписки — в настройках магазина.</p>
          ) : null}
        </div>
      ) : (
        <div className="mp-v2-sub-hint">
          {trialEndLabel != null ? <p>Пробный до {trialEndLabel}</p> : null}
          {subEndLabel != null ? <p>Оплата до {subEndLabel}</p> : null}
        </div>
      )}

      {!b.isBlocked && subLocked ? (
        <div className="mp-v2-warn-banner" role="alert">
          Подписка не активна — оплатите период, чтобы открыть магазин и бота.
        </div>
      ) : null}

      {b.isBlocked && !isPlatformAdmin ? (
        <div className="mp-v2-warn-banner" role="alert">
          Магазин заблокирован оператором. Напишите в поддержку.
        </div>
      ) : null}

      <div className="mp-v2-store-actions">
        <button
          type="button"
          disabled={subLocked}
          onClick={() => onOpenStore(b)}
          className="mp-btn mp-btn--primary mp-btn--sm"
          title={subLocked ? "Оплатите подписку" : undefined}
        >
          Открыть
        </button>
        <button
          type="button"
          disabled={subLocked || settingsBusy}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onOpenSettings(b);
          }}
          className="mp-btn mp-btn--secondary mp-btn--sm"
        >
          {settingsBusy ? "…" : "Настройки"}
        </button>
        <button
          type="button"
          className="mp-btn mp-btn--secondary mp-btn--sm"
          onClick={() => onCopyMiniApp(b)}
        >
          Поделиться
        </button>
      </div>

      <button
        type="button"
        className="mp-v2-details-toggle"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? "Скрыть детали" : "Ссылка Mini App и ещё"}
      </button>

      {detailsOpen ? (
        <div className="mp-v2-details">
          <div className="mp-webhook-block mp-webhook-block--miniapp">
            <div className="mp-webhook-label">Ссылка Mini App</div>
            <div className="mp-webhook-url">{miniAppOpenUrl(b)}</div>
            <div className="mp-copy-row">
              <button
                type="button"
                className="mp-btn mp-btn--secondary mp-btn--sm"
                onClick={() => onCopyMiniApp(b)}
              >
                Скопировать
              </button>
            </div>
          </div>
          {isPlatformAdmin ? (
            <>
              <div className="mp-webhook-block">
                <div className="mp-webhook-label">Вебхук Telegram</div>
                <div className="mp-webhook-url">{webhookUrlLine(b)}</div>
              </div>
              <div className="mp-store-actions-secondary mt-3">
                {b.isBlocked ? (
                  <button
                    type="button"
                    disabled={unblockBusy}
                    onClick={() => onUnblockShop(b)}
                    className="mp-btn mp-btn-enable mp-btn-wide-mobile"
                  >
                    {unblockBusy ? "…" : "Снять блокировку"}
                  </button>
                ) : null}
                {b.isActive && !b.isBlocked ? (
                  <button
                    type="button"
                    disabled={toggleBusy}
                    onClick={() => onToggleBot(b)}
                    className="mp-btn mp-btn--danger mp-btn-wide-mobile"
                  >
                    {toggleBusy ? "…" : "Отключить бота"}
                  </button>
                ) : null}
                {!b.isActive && !b.isBlocked ? (
                  <button
                    type="button"
                    disabled={toggleBusy}
                    onClick={() => onToggleBot(b)}
                    className="mp-btn mp-btn-enable mp-btn-wide-mobile"
                  >
                    {toggleBusy ? "…" : "Включить"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={webhookBusy}
                  onClick={() => onCheckWebhook(b)}
                  className="mp-btn mp-btn--ghost mp-btn-wide-mobile"
                >
                  {webhookBusy ? "Проверка…" : "Проверить webhook"}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => onDeleteShop(b)}
                  className="mp-btn mp-btn--danger-outline mp-btn-wide-mobile"
                >
                  {deleteBusy ? "…" : "Удалить магазин"}
                </button>
                <button
                  type="button"
                  disabled={extendBusy}
                  onClick={() => onExtendSubscription(b, 30)}
                  className="mp-btn mp-btn--secondary mp-btn-wide-mobile"
                >
                  {extendBusy ? "…" : "+30 дн."}
                </button>
                <button
                  type="button"
                  disabled={extendBusy}
                  onClick={() => onExtendSubscription(b, 90)}
                  className="mp-btn mp-btn--secondary mp-btn-wide-mobile"
                >
                  {extendBusy ? "…" : "+90 дн."}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </motion.li>
  );
}
