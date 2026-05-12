import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayInitial } from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
import "./app-shell.css";

type HeaderProps = {
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  /** Красная точка на кнопке меню (например, есть заказы, требующие внимания). */
  attentionDot?: boolean;
  /** Заголовок по центру (например, название магазина на витрине). */
  title?: string;
  onNavigateFaq?: () => void;
  onNavigateAbout?: () => void;
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
  title,
  onNavigateFaq,
  onNavigateAbout,
}: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);
  const initial = telegramDisplayInitial(user);
  const displayName = useMemo(() => telegramDisplayName(user), [user]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userWrapRef = useRef<HTMLDivElement>(null);

  const centerTitle = (title?.trim() || APP_NAME).toUpperCase();

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

  const showUserMenu = Boolean(onNavigateFaq || onNavigateAbout);

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
            aria-haspopup={showUserMenu ? "menu" : undefined}
            title={displayName ?? "Профиль"}
            onClick={() => {
              if (showUserMenu) setUserMenuOpen((o) => !o);
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
                <span className="app-header__user-name">{displayName}</span>
              ) : null}
            </span>
          </button>
          {showUserMenu && userMenuOpen ? (
            <div className="app-header__user-menu" role="menu">
              {onNavigateFaq ? (
                <button
                  type="button"
                  role="menuitem"
                  className="app-header__user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigateFaq();
                  }}
                >
                  FAQ
                </button>
              ) : null}
              {onNavigateAbout ? (
                <button
                  type="button"
                  role="menuitem"
                  className="app-header__user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigateAbout();
                  }}
                >
                  О магазине
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
