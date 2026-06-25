import type { ReactNode } from "react";
import { useMemo } from "react";
import { adminNavKeyFromPath, type AdminNavKey } from "./adminHashRoute";
import {
  MERCHANT_PERM,
  hasMerchantPermission,
  isWaiterRole,
  type MerchantPermissionId,
} from "../../permissions/merchantPermissions";
import { AdminNotificationBell } from "./AdminNotificationBell";
import "./adminOperations.css";

type NavItem = {
  href: string;
  match: AdminNavKey;
  label: string;
  icon: string;
  ownerOnly?: boolean;
  venueOnly?: boolean;
  permission?: MerchantPermissionId;
};

const navAll: NavItem[] = [
  {
    href: "#/admin/orders",
    match: "orders",
    label: "Заказы",
    icon: "📦",
    permission: MERCHANT_PERM.ordersManage,
  },
  {
    href: "#/admin/design",
    match: "design",
    label: "Оформление",
    icon: "🎨",
    permission: MERCHANT_PERM.designEdit,
  },
  {
    href: "#/admin/floor",
    match: "floor",
    label: "Зал live",
    icon: "🪑",
    venueOnly: true,
    permission: MERCHANT_PERM.floorManage,
  },
  {
    href: "#/admin/kitchen",
    match: "kitchen",
    label: "Kitchen",
    icon: "👨‍🍳",
    venueOnly: true,
    permission: MERCHANT_PERM.kitchenView,
  },
  {
    href: "#/admin/tables",
    match: "tables",
    label: "Столики",
    icon: "🍽",
    venueOnly: true,
    permission: MERCHANT_PERM.settingsManage,
  },
  {
    href: "#/admin/reservations",
    match: "reservations",
    label: "Брони",
    icon: "📅",
    venueOnly: true,
    permission: MERCHANT_PERM.settingsManage,
  },
  {
    href: "#/admin/waitlist",
    match: "waitlist",
    label: "Очередь",
    icon: "📋",
    venueOnly: true,
    permission: MERCHANT_PERM.settingsManage,
  },
  {
    href: "#/admin/users",
    match: "users",
    label: "Команда",
    icon: "👥",
    ownerOnly: true,
  },
  {
    href: "#/admin/products",
    match: "products",
    label: "Товары",
    icon: "➕",
    permission: MERCHANT_PERM.catalogEdit,
  },
  {
    href: "#/admin/products/manage",
    match: "manage",
    label: "Каталог",
    icon: "🛍️",
    permission: MERCHANT_PERM.catalogEdit,
  },
  {
    href: "#/admin/categories",
    match: "categories",
    label: "Категории",
    icon: "🗂️",
    permission: MERCHANT_PERM.catalogEdit,
  },
  {
    href: "#/admin/analytics",
    match: "analytics",
    label: "Операции",
    icon: "📊",
    permission: MERCHANT_PERM.analyticsView,
  },
  {
    href: "#/admin/customers",
    match: "customers",
    label: "Клиенты",
    icon: "👤",
    permission: MERCHANT_PERM.analyticsView,
  },
  {
    href: "#/admin/marketing",
    match: "marketing",
    label: "Маркетинг",
    icon: "📣",
    permission: MERCHANT_PERM.analyticsView,
  },
  {
    href: "#/admin/promos",
    match: "promos",
    label: "Промокоды",
    icon: "🎟️",
    permission: MERCHANT_PERM.settingsManage,
  },
  {
    href: "#/admin/delivery",
    match: "delivery",
    label: "Доставка",
    icon: "🚚",
    permission: MERCHANT_PERM.ordersManage,
  },
  {
    href: "#/admin/support",
    match: "support",
    label: "Поддержка",
    icon: "💬",
    permission: MERCHANT_PERM.supportManage,
  },
];

type AdminLayoutProps = {
  onExit: () => void;
  path: string;
  children: ReactNode;
  /** Только владелец видит пункт «Пользователи». */
  showOwnerNav?: boolean;
  /** Права с GET /api/me (для фильтра пунктов меню). */
  merchantPermissions: string[] | null;
  merchantRole?: string | null;
  /** coffee / fastfood — показывать «Столики». */
  showVenueTablesNav?: boolean;
};

export default function AdminLayout({
  onExit,
  path,
  children,
  showOwnerNav = false,
  merchantPermissions,
  merchantRole = null,
  showVenueTablesNav = false,
}: AdminLayoutProps) {
  const active = adminNavKeyFromPath(path);

  const nav = useMemo(
    () =>
      navAll.filter((item) => {
        if (item.ownerOnly && !showOwnerNav) return false;
        if (item.venueOnly && !showVenueTablesNav) return false;
        if (
          isWaiterRole(merchantRole) &&
          item.match !== "floor" &&
          item.match !== "kitchen" &&
          item.match !== "orders" &&
          item.match !== "reservations"
        ) {
          return false;
        }
        return hasMerchantPermission(
          merchantPermissions,
          item.permission,
          merchantRole,
        );
      }),
    [showOwnerNav, showVenueTablesNav, merchantPermissions, merchantRole],
  );

  return (
    <div className="admin-dash">
      <aside className="admin-dash__sidebar">
        <div className="admin-dash__brand">
          <div className="admin-dash__brand-row">
            <span className="admin-dash__brand-title">Админ</span>
            <AdminNotificationBell />
          </div>
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
