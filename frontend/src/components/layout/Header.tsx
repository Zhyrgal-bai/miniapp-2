import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayInitial } from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
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
  isMerchantStaff = false,
  accountMenu,
  merchantMenu,
}: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);
  const initial = telegramDisplayInitial(user);
  const displayName = useMemo(() => telegramDisplayName(user), [user]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const centerTitle = (title?.trim() || APP_NAME).toUpperCase();
  const shopLine = (storeName ?? title)?.trim() || null;

  const showAccountPanel = Boolean(accountMenu);

  useEffect(() => {
    if (!userMenuOpen || !showAccountPanel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [userMenuOpen, showAccountPanel]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [userMenuOpen]);

  const closeMenu = () => setUserMenuOpen(false);

  const sheetPortal =
    typeof document !== "undefined" && showAccountPanel && accountMenu
      ? createPortal(
          <AnimatePresence>
            {userMenuOpen ? (
              <>
                <motion.div
                  key="acct-sheet-backdrop"
                  role="presentation"
                  className="app-header__sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={closeMenu}
                />
                <motion.div
                  key="acct-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Аккаунт и поддержка"
                  className="app-header__sheet"
                  initial={{ y: "104%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "104%" }}
                  transition={{ type: "spring", damping: 32, stiffness: 380 }}
                >
                  <div className="app-header__sheet-handle" aria-hidden />

                  <div className="app-header__account-profile">
                    <div className="app-header__account-avatar" aria-hidden>
                      {user?.photo_url ? (
                        <img src={user.photo_url} alt="" width={48} height={48} />
                      ) : (
                        <span className="app-header__account-avatar-fallback">
                          {initial}
                        </span>
                      )}
                    </div>
                    <div className="app-header__account-meta">
                      <div className="app-header__account-name">
                        {displayName ?? "Гость"}
                      </div>
                      {user?.username ? (
                        <div className="app-header__account-handle">
                          @{user.username}
                        </div>
                      ) : (
                        <div className="app-header__account-handle">Telegram</div>
                      )}
                      {shopLine ? (
                        <div className="app-header__account-store">{shopLine}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="app-header__account-scroll">
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
                  </div>

                  <div className="app-header__sheet-support-cap">
                    <div className="app-header__sheet-support-cap-main">
                      <span className="app-header__sheet-support-cap-title">
                        Чат поддержки
                      </span>
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
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <header className="app-header">
      {sheetPortal}

      <div className="app-header__cell app-header__cell--left">
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
      </div>

      <h1 className="app-header__logo">{centerTitle}</h1>

      <div className="app-header__cell app-header__cell--right">
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
              {displayName ? (
                <span className="app-header__user-name app-header__user-name--trigger">
                  {displayName}
                </span>
              ) : null}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
