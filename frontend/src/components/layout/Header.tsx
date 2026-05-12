import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayInitial } from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
import "./app-shell.css";

export type HeaderAccountCallbacks = {
  onMyOrders: () => void;
  onSupport: () => void;
  onReturns: () => void;
  onFaq: () => void;
  onAbout: () => void;
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
  const userWrapRef = useRef<HTMLDivElement>(null);

  const centerTitle = (title?.trim() || APP_NAME).toUpperCase();
  const shopLine = (storeName ?? title)?.trim() || null;

  const showAccountPanel = Boolean(accountMenu);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = userWrapRef.current;
      if (el && !el.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const closeMenu = () => setUserMenuOpen(false);

  return (
    <header className="app-header">
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
          ref={userWrapRef}
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

          <AnimatePresence>
            {showAccountPanel && userMenuOpen && accountMenu ? (
              <motion.div
                key="account-panel"
                role="dialog"
                aria-label="Профиль и поддержка"
                className="app-header__account-panel"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.99 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="app-header__account-profile">
                  <div className="app-header__account-avatar" aria-hidden>
                    {user?.photo_url ? (
                      <img
                        src={user.photo_url}
                        alt=""
                        width={48}
                        height={48}
                      />
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
                    <div className="app-header__account-section-label">
                      Покупатель
                    </div>
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
                        accountMenu.onSupport();
                      }}
                    >
                      <span className="app-header__account-item-icon" aria-hidden>
                        💬
                      </span>
                      <span className="app-header__account-item-text">
                        Поддержка
                      </span>
                      <span className="app-header__account-item-hint">
                        по заказу
                      </span>
                    </button>
                    <button
                      type="button"
                      className="app-header__account-item"
                      onClick={() => {
                        closeMenu();
                        accountMenu.onReturns();
                      }}
                    >
                      <span className="app-header__account-item-icon" aria-hidden>
                        ↩️
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
                        accountMenu.onFaq();
                      }}
                    >
                      <span className="app-header__account-item-icon" aria-hidden>
                        ❓
                      </span>
                      <span className="app-header__account-item-text">FAQ</span>
                    </button>
                    <button
                      type="button"
                      className="app-header__account-item"
                      onClick={() => {
                        closeMenu();
                        accountMenu.onAbout();
                      }}
                    >
                      <span className="app-header__account-item-icon" aria-hidden>
                        ℹ️
                      </span>
                      <span className="app-header__account-item-text">
                        О магазине
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
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
