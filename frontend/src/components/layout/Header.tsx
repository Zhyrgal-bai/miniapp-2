import { useMemo } from "react";
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
}: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);
  const initial = telegramDisplayInitial(user);
  const displayName = useMemo(() => telegramDisplayName(user), [user]);

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

      <h1 className="app-header__logo">{APP_NAME}</h1>

      <div className="app-header__cell app-header__cell--right">
        <div className="app-header__user" title={displayName ?? undefined}>
          <div
            className="app-header__mark"
            aria-hidden={displayName ? true : undefined}
            title={user?.first_name?.trim() || user?.username || undefined}
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
          </div>
          {displayName ? (
            <span className="app-header__user-name">{displayName}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
