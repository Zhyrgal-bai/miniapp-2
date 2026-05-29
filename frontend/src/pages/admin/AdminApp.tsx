import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AdminLayout from "./AdminLayout";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminProductsPage from "./AdminProductsPage";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import AdminProductManagePage from "./AdminProductManagePage";
import AdminCategoriesPage from "./AdminCategoriesPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminDesignPage from "./AdminDesignPage";
import AdminSupportPage from "./AdminSupportPage";
import AdminPromosPage from "./AdminPromosPage";
import AdminTablesPage from "./AdminTablesPage";
import AdminReservationsPage from "./AdminReservationsPage";
import AdminWaitlistPage from "./AdminWaitlistPage";
import AdminFloorPage from "./AdminFloorPage";
import AdminKitchenPage from "./AdminKitchenPage";
import { useShop } from "../../context/ShopContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { adminService } from "../../services/admin.service";
import AdminErrorBoundary from "./AdminErrorBoundary";
import TelegramSessionGate from "../../components/ui/TelegramSessionGate";
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
  promos: MERCHANT_PERM.settingsManage,
  support: MERCHANT_PERM.supportManage,
  tables: MERCHANT_PERM.settingsManage,
  floor: MERCHANT_PERM.floorManage,
  kitchen: MERCHANT_PERM.kitchenView,
  reservations: MERCHANT_PERM.settingsManage,
  waitlist: MERCHANT_PERM.settingsManage,
};

const ROUTE_ORDER: { key: AdminNavKey; hash: string }[] = [
  { key: "orders", hash: "#/admin/orders" },
  { key: "support", hash: "#/admin/support" },
  { key: "design", hash: "#/admin/design" },
  { key: "products", hash: "#/admin/products" },
  { key: "categories", hash: "#/admin/categories" },
  { key: "promos", hash: "#/admin/promos" },
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
  const { businessId } = useShop();
  const merchantRole = useAdminGateStore((s) => s.merchantRole);
  const gateStatus = useAdminGateStore((s) => s.status);
  const serverIsAdmin = useAdminGateStore((s) => s.serverIsAdmin);
  const merchantPermissions = useAdminGateStore((s) => s.merchantPermissions);
  const [showVenueTablesNav, setShowVenueTablesNav] = useState(false);

  useEffect(() => {
    if (businessId == null) {
      setShowVenueTablesNav(false);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const schema = await adminService.getMerchantSchemas();
        if (!alive) return;
        setShowVenueTablesNav(
          businessTypeSupportsTableReservations(String(schema.businessType ?? "")),
        );
      } catch {
        if (alive) setShowVenueTablesNav(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId]);

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
    if (
      !path.includes("/admin/tables") &&
      !path.includes("/admin/reservations") &&
      !path.includes("/admin/waitlist") &&
      !path.includes("/admin/floor") &&
      !path.includes("/admin/kitchen")
    ) {
      return;
    }
    if (showVenueTablesNav) return;
    window.location.hash = firstAllowedAdminHash(
      merchantRole,
      merchantPermissions,
    );
  }, [path, showVenueTablesNav, merchantRole, merchantPermissions]);

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
    if (path.includes("/admin/floor")) {
      return <AdminFloorPage key="floor" />;
    }
    if (path.includes("/admin/kitchen")) {
      return <AdminKitchenPage key="kitchen" />;
    }
    if (path.includes("/admin/tables")) {
      return <AdminTablesPage key="tables" />;
    }
    if (path.includes("/admin/reservations")) {
      return <AdminReservationsPage key="reservations" />;
    }
    if (path.includes("/admin/waitlist")) {
      return <AdminWaitlistPage key="waitlist" />;
    }
    if (path.includes("/admin/promos")) {
      return <AdminPromosPage key="promos" />;
    }
    if (path.includes("/admin/support")) {
      return <AdminSupportPage key="support" />;
    }
    return <AdminOrdersPage key="orders" />;
  }, [path, merchantRole, gateStatus, merchantPermissions]);

  return (
    <TelegramSessionGate>
      <AdminLayout
        onExit={onExit}
        path={path}
        showOwnerNav={merchantRole === "OWNER"}
        merchantPermissions={merchantPermissions}
        merchantRole={merchantRole}
        showVenueTablesNav={showVenueTablesNav}
      >
        <AdminErrorBoundary>{page}</AdminErrorBoundary>
      </AdminLayout>
    </TelegramSessionGate>
  );
}
