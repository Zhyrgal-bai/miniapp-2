import { useState } from "react";
import type { ReactNode } from "react";
import Header from "./Header";
import "./layout.css";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNav?: (page: "home" | "cart" | "admin") => void;
  isAdmin?: boolean;
};

function SideMenu({ open, onClose, onNav, isAdmin = false }: SideMenuProps) {
  return (
    <>
      <div
        className={`overlay${open ? " active" : ""}`}
        onClick={onClose}
      />
      <nav className={`side-menu${open ? " open" : ""}`}>
        <button onClick={() => onNav?.("home")}>Главная</button>
        <button onClick={() => onNav?.("cart")}>Корзина</button>
        {isAdmin && (
          <button type="button" onClick={() => onNav?.("admin")}>
            Админка
          </button>
        )}
      </nav>
    </>
  );
}

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  // DEBUG: принудительный доступ (см. также adminAccess.ts)
  const isAdmin = true;

  // Add animation class for open menu, e.g., "menu-open"
  const appClassName = `app${menuOpen ? " menu-open" : ""}`;

  // --- Integration: add overlay when menu is open ---
  // This overlay will close the menu on click, mimicking mobile drawer
  const handleMenuToggle = () => setMenuOpen((prev) => !prev);
  const handleMenuClose = () => setMenuOpen(false);

  return (
    <div className={appClassName} style={{ position: "relative", minHeight: "100vh" }}>
      {/* Header at the top; pass onMenuToggle to Header */}
      <Header onMenuToggle={handleMenuToggle} />
      {/* SideMenu receives open and onClose;
          onNav is optional and not supplied here */}
      <SideMenu open={menuOpen} onClose={handleMenuClose} isAdmin={isAdmin} />
      {/* Overlay to capture clicks and close menu */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.34)",
            zIndex: 40,
            transition: "background 0.24s",
          }}
          onClick={handleMenuClose}
          aria-label="Close menu overlay"
        />
      )}
      {/* Wrapper div for content */}
      <div className="content">
        {children}
      </div>
    </div>
  );
}
