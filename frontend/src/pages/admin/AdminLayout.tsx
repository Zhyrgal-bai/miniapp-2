import type { ReactNode } from "react";
import { useMemo } from "react";
import { adminNavKeyFromPath, type AdminNavKey } from "./adminHashRoute";

type NavItem = {
  href: string;
  match: AdminNavKey;
  label: string;
  icon: string;
  ownerOnly?: boolean;
};

const navAll: NavItem[] = [
  { href: "#/admin/orders", match: "orders", label: "Заказы", icon: "📦" },
  {
    href: "#/admin/users",
    match: "users",
    label: "Пользователи",
    icon: "👥",
    ownerOnly: true,
  },
  { href: "#/admin/products", match: "products", label: "Товары", icon: "➕" },
  {
    href: "#/admin/products/manage",
    match: "manage",
    label: "Каталог",
    icon: "🛍️",
  },
  {
    href: "#/admin/categories",
    match: "categories",
    label: "Категории",
    icon: "🗂️",
  },
  { href: "#/admin/analytics", match: "analytics", label: "Аналитика", icon: "📊" },
  { href: "#/admin/settings", match: "settings", label: "Настройки", icon: "⚙️" },
];

type AdminLayoutProps = {
  onExit: () => void;
  path: string;
  children: ReactNode;
  /** Только владелец видит пункт «Пользователи». */
  showOwnerNav?: boolean;
};

export default function AdminLayout({
  onExit,
  path,
  children,
  showOwnerNav = false,
}: AdminLayoutProps) {
  const active = adminNavKeyFromPath(path);

  const nav = useMemo(
    () => navAll.filter((item) => !item.ownerOnly || showOwnerNav),
    [showOwnerNav],
  );

  return (
    <div className="admin-dash">
      <aside className="admin-dash__sidebar">
        <div className="admin-dash__brand">
          <span className="admin-dash__brand-title">Админ</span>
          <button type="button" className="admin-dash__exit" onClick={onExit}>
            ← В магазин
          </button>
        </div>
        <nav className="admin-dash__nav" aria-label="Админ-разделы">
          {nav.map(({ href, match, label, icon }) => {
            const isActive = active === match;
            return (
              <a
                key={href}
                href={href}
                className={`admin-dash__nav-link${isActive ? " admin-dash__nav-link--active" : ""}`}
              >
                <span className="admin-dash__nav-icon" aria-hidden>
                  {icon}
                </span>
                {label}
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="admin-dash__main">{children}</main>
    </div>
  );
}
