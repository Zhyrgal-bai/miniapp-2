import { useEffect, useMemo, useSyncExternalStore } from "react";
import AdminLayout from "./AdminLayout";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminProductsPage from "./AdminProductsPage";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminProductManagePage from "./AdminProductManagePage";
import AdminCategoriesPage from "./AdminCategoriesPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminErrorBoundary from "./AdminErrorBoundary";
import {
  adminPathFromHash,
  subscribeAdminHash,
} from "./adminHashRoute";
import { useAdminGateStore } from "../../store/adminGate.store";

type AdminAppProps = {
  onExit: () => void;
};

export default function AdminApp({ onExit }: AdminAppProps) {
  const merchantRole = useAdminGateStore((s) => s.merchantRole);
  const gateStatus = useAdminGateStore((s) => s.status);

  const path = useSyncExternalStore(
    subscribeAdminHash,
    adminPathFromHash,
    () => "/admin/orders"
  );

  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (!h || h === "/" || !h.includes("admin")) {
      window.location.hash = "#/admin/orders";
    }
  }, []);

  useEffect(() => {
    if (!path.includes("/admin/users")) return;
    if (gateStatus !== "ready") return;
    if (merchantRole === "OWNER") return;
    window.location.hash = "#/admin/orders";
  }, [path, gateStatus, merchantRole]);

  const page = useMemo(() => {
    if (path.includes("/admin/users")) {
      if (merchantRole === "OWNER") {
        return <AdminUsersPage key="users" />;
      }
      return (
        <div className="admin-page admin-users-gate" key="users-gate">
          <p className="muted">Загрузка доступа…</p>
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
    if (path.includes("/admin/settings")) {
      return <AdminSettingsPage key="settings" />;
    }
    return <AdminOrdersPage key="orders" />;
  }, [path, merchantRole]);

  return (
    <AdminLayout
      onExit={onExit}
      path={path}
      showOwnerNav={merchantRole === "OWNER"}
    >
      <AdminErrorBoundary>{page}</AdminErrorBoundary>
    </AdminLayout>
  );
}
