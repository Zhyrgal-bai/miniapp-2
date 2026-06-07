import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayInitial } from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
import { buildCloudinaryResponsiveUrl } from "../../utils/cloudinaryTransforms";
import { storeBrandInitials } from "./storeBrandHeaderUtils";
import { ArchaOverlay } from "../ui/ArchaOverlay";
import "../ui/archaOverlay.css";
import "./app-shell.css";

export type HeaderAccountCallbacks = {
  onGoToStore: () => void;
  onMyOrders: () => void;
  /** Полноэкранный хаб поддержки (не FAQ). */
  onOpenSupportHub: () => void;
};

export type HeaderMerchantCallbacks = {
  onCustomerSupport: () => void;
  onReturns: () => void;
  onTickets: () => void;
  onSupportAnalytics: () => void;
};

type HeaderProps = {
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  attentionDot?: boolean;
  /** Точка у «Мои заказы» в профиле (ожидает оплату и т.п.). */
  ordersAttentionDot?: boolean;
  title?: string;
  storeName?: string;
  /** Логотип магазина (theme.logoUrl). */
  logoUrl?: string | null;
  /** Premium identity header (витрина). */
  storeBrandMode?: boolean;
  /** Открыть профиль магазина (bottom sheet). */
  onOpenStoreProfile?: () => void;
  /** Показать блок «Магазин» (OWNER/ADMIN). */
  isMerchantStaff?: boolean;
  accountMenu?: HeaderAccountCallbacks;
  merchantMenu?: HeaderMerchantCallbacks;
};

function telegramDisplayName(user: ReturnType<typeof getTelegramUser>): string | null {
  if (!user) return null;
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.username?.trim()) return `@${user.username.trim()}`;
  return null;
}

export default function Header({
  menuOpen = false,
  onMenuToggle,
  attentionDot = false,
  ordersAttentionDot = false,
  title,
  storeName,
  logoUrl,
  storeBrandMode = false,
  onOpenStoreProfile,
  isMerchantStaff = false,
  accountMenu,
  merchantMenu,
}: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);
  const initial = telegramDisplayInitial(user);
  const displayName = useMemo(() => telegramDisplayName(user), [user]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayNameRaw = (storeName ?? title)?.trim() || "";
  const centerTitle = displayNameRaw !== "" ? displayNameRaw : APP_NAME;
  const shopLine = displayNameRaw || null;
  const logoSrc =
    logoUrl != null && logoUrl.trim() !== ""
      ? buildCloudinaryResponsiveUrl(logoUrl.trim(), "thumbnail")
      : "";
  const useStoreBrand = storeBrandMode && displayNameRaw !== "";
  const storeInitials = storeBrandInitials(displayNameRaw || APP_NAME);

  const showAccountPanel = Boolean(accountMenu);

  const closeMenu = () => setUserMenuOpen(false);

  const accountSheet =
    showAccountPanel && accountMenu ? (
      <ArchaOverlay
        open={userMenuOpen}
        onClose={closeMenu}
        ariaLabel="Аккаунт и поддержка"
        layer="header"
        panelClassName="app-header__sheet"
        scrollClassName="app-header__account-scroll"
        header={
          <div className="app-header__account-profile">
            <div className="app-header__account-avatar" aria-hidden>
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" width={48} height={48} />
              ) : (
                <span className="app-header__account-avatar-fallback">{initial}</span>
              )}
            </div>
            <div className="app-header__account-meta">
              <div className="app-header__account-name">{displayName ?? "Гость"}</div>
              {user?.username ? (
                <div className="app-header__account-handle">@{user.username}</div>
              ) : (
                <div className="app-header__account-handle">Telegram</div>
              )}
              {shopLine ? (
                <div className="app-header__account-store">{shopLine}</div>
              ) : null}
            </div>
          </div>
        }
        footer={
          <div className="app-header__sheet-support-cap">
            <div className="app-header__sheet-support-cap-main">
              <span className="app-header__sheet-support-cap-title">Чат поддержки</span>
              <span className="app-header__sheet-support-cap-sub">
                Заказы · доставка · возвраты
              </span>
            </div>
            <button
              type="button"
              className="app-header__sheet-support-cap-cta"
              onClick={() => {
                closeMenu();
                accountMenu.onOpenSupportHub();
              }}
            >
              Открыть
            </button>
          </div>
        }
      >
                    <div className="app-header__account-section">
                      <button
                        type="button"
                        className="app-header__account-item"
                        onClick={() => {
                          closeMenu();
                          accountMenu.onGoToStore();
                        }}
                      >
                        <span className="app-header__account-item-icon" aria-hidden>
                          🛍
                        </span>
                        <span className="app-header__account-item-text">Магазин</span>
                      </button>
                      <button
                        type="button"
                        className="app-header__account-item"
                        onClick={() => {
                          closeMenu();
                          accountMenu.onMyOrders();
                        }}
                      >
                        <span className="app-header__account-item-icon" aria-hidden>
                          📦
                        </span>
                        <span className="app-header__account-item-text">
                          Мои заказы
                        </span>
                        {ordersAttentionDot ? (
                          <span
                            className="app-header__account-item-dot"
                            title="Нужно действие"
                          />
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="app-header__account-item app-header__account-item--support"
                        onClick={() => {
                          closeMenu();
                          accountMenu.onOpenSupportHub();
                        }}
                      >
                        <span className="app-header__account-item-icon" aria-hidden>
                          💬
                        </span>
                        <span className="app-header__account-item-text">
                          Поддержка
                        </span>
                        <span className="app-header__account-item-hint">
                          чат по заказу
                        </span>
                      </button>
                    </div>

                    {isMerchantStaff && merchantMenu ? (
                      <div className="app-header__account-section app-header__account-section--merchant">
                        <div className="app-header__account-section-label">
                          Магазин
                        </div>
                        <button
                          type="button"
                          className="app-header__account-item app-header__account-item--support"
                          onClick={() => {
                            closeMenu();
                            merchantMenu.onCustomerSupport();
                          }}
                        >
                          <span className="app-header__account-item-icon" aria-hidden>
                            🛎️
                          </span>
                          <span className="app-header__account-item-text">
                            Поддержка клиентов
                          </span>
                        </button>
                        <button
                          type="button"
                          className="app-header__account-item"
                          onClick={() => {
                            closeMenu();
                            merchantMenu.onReturns();
                          }}
                        >
                          <span className="app-header__account-item-icon" aria-hidden>
                            📋
                          </span>
                          <span className="app-header__account-item-text">
                            Возвраты
                          </span>
                        </button>
                        <button
                          type="button"
                          className="app-header__account-item"
                          onClick={() => {
                            closeMenu();
                            merchantMenu.onTickets();
                          }}
                        >
                          <span className="app-header__account-item-icon" aria-hidden>
                            🎫
                          </span>
                          <span className="app-header__account-item-text">
                            Тикеты
                          </span>
                        </button>
                        <button
                          type="button"
                          className="app-header__account-item"
                          onClick={() => {
                            closeMenu();
                            merchantMenu.onSupportAnalytics();
                          }}
                        >
                          <span className="app-header__account-item-icon" aria-hidden>
                            📊
                          </span>
                          <span className="app-header__account-item-text">
                            Аналитика поддержки
                          </span>
                        </button>
                      </div>
                    ) : null}
      </ArchaOverlay>
    ) : null;

  const burgerButton = (
    <div className="app-header__burger-wrap">
      <motion.button
        type="button"
        className={`app-header__burger${menuOpen ? " app-header__burger--open" : ""}`}
        onClick={onMenuToggle}
        aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={menuOpen}
        whileTap={{ scale: 0.94 }}
      >
        <span className="app-header__burger-line" />
        <span className="app-header__burger-line" />
        <span className="app-header__burger-line" />
      </motion.button>
      {attentionDot ? (
        <span className="app-header__notify-dot" title="Есть уведомления" />
      ) : null}
    </div>
  );

  const userButton = (
    <div
      className={`app-header__user-wrap${userMenuOpen ? " app-header__user-wrap--open" : ""}`}
    >
      <button
        type="button"
        className="app-header__user-trigger"
        aria-expanded={userMenuOpen}
        aria-haspopup={showAccountPanel ? "dialog" : undefined}
        title={displayName ?? "Профиль и поддержка"}
        onClick={() => {
          if (showAccountPanel) setUserMenuOpen((o) => !o);
        }}
      >
        <span className="app-header__user app-header__user--trigger-inner">
          <span
            className="app-header__mark"
            aria-hidden={displayName ? true : undefined}
          >
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName ?? user.first_name ?? ""}
                width={40}
                height={40}
              />
            ) : (
              initial
            )}
          </span>
          {displayName && !useStoreBrand ? (
            <span className="app-header__user-name app-header__user-name--trigger">
              {displayName}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );

  if (useStoreBrand) {
    const storeProfileButton = onOpenStoreProfile ? (
      <motion.button
        type="button"
        className="app-header__store-logo app-header__store-logo--btn"
        aria-label="Профиль магазина"
        onClick={onOpenStoreProfile}
        whileTap={{ scale: 0.94 }}
      >
        {logoSrc !== "" ? (
          <img src={logoSrc} alt="" width={40} height={40} />
        ) : (
          <span className="app-header__store-logo-fallback">{storeInitials}</span>
        )}
      </motion.button>
    ) : (
      userButton
    );

    return (
      <header className="app-header app-header--store-brand">
        {accountSheet}
        <div className="app-header__brand-card">
          <div className="app-header__brand-slot app-header__brand-slot--left">
            {burgerButton}
          </div>
          <div className="app-header__brand-slot app-header__brand-slot--center">
            <h1 className="app-header__store-name">{centerTitle}</h1>
          </div>
          <div className="app-header__brand-slot app-header__brand-slot--right">
            {storeProfileButton}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      {accountSheet}

      <div className="app-header__cell app-header__cell--left">{burgerButton}</div>

      <h1 className="app-header__logo">{centerTitle}</h1>

      <div className="app-header__cell app-header__cell--right">{userButton}</div>
    </header>
  );
}
