import { useCallback, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import "./platformDashboard.css";

export type PlatformMenuItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
};

type PlatformShellProps = {
  subtitle: string;
  roleLabel: string;
  isAdmin: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menuItems: PlatformMenuItem[];
  operatorAction?: ReactNode;
  children: ReactNode;
};

export function PlatformShell({
  subtitle,
  roleLabel,
  isAdmin,
  menuOpen,
  onMenuOpenChange,
  menuItems,
  operatorAction,
  children,
}: PlatformShellProps) {
  const closeMenu = useCallback(() => onMenuOpenChange(false), [onMenuOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  return (
    <>
      <header className="mp-v2-header">
        <div className="mp-v2-header-top">
          <div className="mp-v2-header-brand">
            <div className="mp-v2-logo-wrap">
              <span className="mp-v2-logo-glow" aria-hidden />
              <img
                className="mp-v2-logo"
                src="/674440574_18101674030793392_828162833995675842_n.jpg"
                alt="ARCHA"
                width={48}
                height={48}
              />
            </div>
            <div className="min-w-0">
              <h1 className="mp-v2-title">ARCHA</h1>
              <p className="mp-v2-subtitle">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="mp-v2-burger"
            aria-label="Меню"
            aria-expanded={menuOpen}
            onClick={() => onMenuOpenChange(!menuOpen)}
          >
            <span className="mp-v2-burger-lines" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
        <div className="mp-v2-header-meta">
          <span
            className={`mp-v2-role-pill ${isAdmin ? "mp-v2-role-pill--admin" : ""}`}
          >
            {roleLabel}
          </span>
          {operatorAction}
        </div>
      </header>

      {children}

      {menuOpen ? (
        <>
          <button
            type="button"
            className="mp-v2-menu-backdrop"
            aria-label="Закрыть меню"
            onClick={closeMenu}
          />
          <aside className="mp-v2-menu-drawer" role="dialog" aria-label="Навигация">
            <div className="mp-v2-menu-head">
              <h2>Меню</h2>
              <button
                type="button"
                className="mp-v2-menu-close"
                aria-label="Закрыть"
                onClick={closeMenu}
              >
                ×
              </button>
            </div>
            <nav className="mp-v2-menu-nav">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`mp-v2-menu-item ${item.danger ? "mp-v2-menu-item--danger" : ""}`}
                  onClick={() => {
                    closeMenu();
                    item.onClick();
                  }}
                >
                  <span className="mp-v2-menu-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </nav>
            <p className="mp-v2-menu-footer">ARCHA · Mini App</p>
          </aside>
        </>
      ) : null}
    </>
  );
}

export function PlatformQuickActions({
  actions,
}: {
  actions: Array<{
    id: string;
    label: string;
    icon: string;
    onClick: () => void;
    disabled?: boolean;
    accent?: boolean;
  }>;
}) {
  if (actions.length === 0) return null;
  return (
    <section className="mp-v2-section" aria-label="Быстрые действия">
      <h2 className="mp-v2-section-title">Быстрые действия</h2>
      <div className="mp-v2-quick-grid">
        {actions.map((a) => (
          <motion.button
            key={a.id}
            type="button"
            className={`mp-v2-quick-btn ${a.accent ? "mp-v2-quick-btn--accent" : ""}`}
            disabled={a.disabled}
            onClick={a.onClick}
            whileTap={{ scale: 0.97 }}
          >
            <span className="mp-v2-quick-icon" aria-hidden>
              {a.icon}
            </span>
            {a.label}
          </motion.button>
        ))}
      </div>
    </section>
  );
}
