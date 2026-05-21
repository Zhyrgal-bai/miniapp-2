import { useEffect, useMemo, useSyncExternalStore } from "react";
import AdminLayout from "./AdminLayout";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminProductsPage from "./AdminProductsPage";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import AdminProductManagePage from "./AdminProductManagePage";
import AdminCategoriesPage from "./AdminCategoriesPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminDesignPage from "./AdminDesignPage";
import AdminSupportPage from "./AdminSupportPage";
import AdminErrorBoundary from "./AdminErrorBoundary";
import {
  adminPathFromHash,
  adminNavKeyFromPath,
  subscribeAdminHash,
  type AdminNavKey,
} from "./adminHashRoute";
import { useAdminGateStore } from "../../store/adminGate.store";
import {
  MERCHANT_PERM,
  hasMerchantPermission,
  type MerchantPermissionId,
} from "../../permissions/merchantPermissions";

const NAV_REQUIRES: Partial<Record<AdminNavKey, MerchantPermissionId>> = {
  orders: MERCHANT_PERM.ordersManage,
  design: MERCHANT_PERM.designEdit,
  products: MERCHANT_PERM.catalogEdit,
  manage: MERCHANT_PERM.catalogEdit,
  categories: MERCHANT_PERM.catalogEdit,
  analytics: MERCHANT_PERM.analyticsView,
  support: MERCHANT_PERM.supportManage,
};

const ROUTE_ORDER: { key: AdminNavKey; hash: string }[] = [
  { key: "orders", hash: "#/admin/orders" },
  { key: "support", hash: "#/admin/support" },
  { key: "design", hash: "#/admin/design" },
  { key: "products", hash: "#/admin/products" },
  { key: "categories", hash: "#/admin/categories" },
  { key: "analytics", hash: "#/admin/analytics" },
];

function firstAllowedAdminHash(
  merchantRole: string | null,
  merchantPermissions: string[] | null,
): string {
  if (merchantRole === "OWNER") return "#/admin/orders";
  for (const route of ROUTE_ORDER) {
    const req = NAV_REQUIRES[route.key];
    if (hasMerchantPermission(merchantPermissions, req, merchantRole)) {
      return route.hash;
    }
  }
  return "#/admin/support";
}

type AdminAppProps = {
  onExit: () => void;
};

export default function AdminApp({ onExit }: AdminAppProps) {
  const merchantRole = useAdminGateStore((s) => s.merchantRole);
  const gateStatus = useAdminGateStore((s) => s.status);
  const serverIsAdmin = useAdminGateStore((s) => s.serverIsAdmin);
  const merchantPermissions = useAdminGateStore((s) => s.merchantPermissions);

  const path = useSyncExternalStore(
    subscribeAdminHash,
    adminPathFromHash,
    () => "/admin/orders",
  );

  useEffect(() => {
    if (gateStatus !== "ready" || !serverIsAdmin) return;
    const h = window.location.hash.replace(/^#/, "");
    if (!h || h === "/" || !h.includes("admin")) {
      window.location.hash = firstAllowedAdminHash(
        merchantRole,
        merchantPermissions,
      );
    }
  }, [gateStatus, serverIsAdmin, merchantRole, merchantPermissions]);

  useEffect(() => {
    if (!path.includes("/admin/users")) return;
    if (gateStatus !== "ready") return;
    if (merchantRole === "OWNER") return;
    window.location.hash = firstAllowedAdminHash(
      merchantRole,
      merchantPermissions,
    );
  }, [path, gateStatus, merchantRole, merchantPermissions]);

  useEffect(() => {
    if (!path.includes("/admin/settings")) return;
    window.location.hash = "#/admin/design";
  }, [path]);

  useEffect(() => {
    if (gateStatus !== "ready" || !serverIsAdmin) return;
    const key = adminNavKeyFromPath(path);
    if (key === "users") return;
    const req = NAV_REQUIRES[key];
    if (
      req &&
      !hasMerchantPermission(merchantPermissions, req, merchantRole)
    ) {
      window.location.hash = firstAllowedAdminHash(
        merchantRole,
        merchantPermissions,
      );
    }
  }, [path, gateStatus, serverIsAdmin, merchantPermissions, merchantRole]);

  const page = useMemo(() => {
    if (gateStatus !== "ready") {
      return (
        <div className="admin-page admin-users-gate" key="gate-loading">
          <p className="muted">Загрузка доступа…</p>
        </div>
      );
    }

    const key = adminNavKeyFromPath(path);
    if (key !== "users") {
      const req = NAV_REQUIRES[key];
      if (
        req &&
        !hasMerchantPermission(merchantPermissions, req, merchantRole)
      ) {
        return (
          <div className="admin-page admin-users-gate" key="denied">
            <p className="muted">Нет доступа к этому разделу</p>
          </div>
        );
      }
    }

    if (path.includes("/admin/users")) {
      if (merchantRole === "OWNER") {
        return <AdminUsersPage key="users" />;
      }
      return (
        <div className="admin-page admin-users-gate" key="users-gate">
          <p className="muted">Нет доступа</p>
        </div>
      );
    }
    if (path.includes("/admin/products/manage")) {
      return <AdminProductManagePage key="manage" />;
    }
    if (path.includes("/admin/products")) {
      return <AdminProductsPage key="products" />;
    }
    if (path.includes("/admin/analytics")) {
      return <AdminAnalyticsPage key="analytics" />;
    }
    if (path.includes("/admin/categories")) {
      return <AdminCategoriesPage key="categories" />;
    }
    if (path.includes("/admin/design")) {
      return <AdminDesignPage key="design" />;
    }
    if (path.includes("/admin/support")) {
      return <AdminSupportPage key="support" />;
    }
    return <AdminOrdersPage key="orders" />;
  }, [path, merchantRole, gateStatus, merchantPermissions]);

  return (
    <AdminLayout
      onExit={onExit}
      path={path}
      showOwnerNav={merchantRole === "OWNER"}
      merchantPermissions={merchantPermissions}
      merchantRole={merchantRole}
    >
      <AdminErrorBoundary>{page}</AdminErrorBoundary>
    </AdminLayout>
  );
}
