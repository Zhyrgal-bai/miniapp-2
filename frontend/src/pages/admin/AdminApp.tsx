import { useEffect, useMemo, useSyncExternalStore } from "react";
import AdminLayout from "./AdminLayout";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminProductsPage from "./AdminProductsPage";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminProductManagePage from "./AdminProductManagePage";
import AdminCategoriesPage from "./AdminCategoriesPage";
import AdminErrorBoundary from "./AdminErrorBoundary";
import {
  adminPathFromHash,
  subscribeAdminHash,
} from "./adminHashRoute";

type AdminAppProps = {
  onExit: () => void;
};

export default function AdminApp({ onExit }: AdminAppProps) {
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

  const page = useMemo(() => {
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
  }, [path]);

  return (
    <AdminLayout onExit={onExit} path={path}>
      <AdminErrorBoundary>{page}</AdminErrorBoundary>
    </AdminLayout>
  );
}
