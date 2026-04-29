import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminApp from "./pages/admin/AdminApp";
import FAQ from "./pages/FAQ";
import MyOrders from "./pages/MyOrders";
import ConnectBotPage from "./pages/ConnectBotPage";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCartStore } from "./store/useCartStore";
import { useAdminPanelVisible, useAdminAccessBootstrap } from "@/utils/admin";
import { fetchMyOrders } from "./services/myOrdersApi";
import { getWebAppUserId } from "./utils/telegramUserId";
import type { MyOrderRow } from "./types/myOrder";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";

type AppNavPage =
  | "home"
  | "cart"
  | "checkout"
  | "admin"
  | "faq"
  | "my-orders"
  | "connect-bot";

function myOrdersNeedAttention(rows: MyOrderRow[]): boolean {
  return rows.some((o) => {
    const s = String(o.status).toUpperCase();
    return s === "ACCEPTED" || s === "PAID_PENDING";
  });
}

function initialPageFromPath(): AppNavPage {
  if (typeof window === "undefined") return "home";
  return window.location.pathname === "/faq" ? "faq" : "home";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState<AppNavPage>(initialPageFromPath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [myOrdersAttention, setMyOrdersAttention] = useState(false);
  const adminAllowed = useAdminPanelVisible();
  useAdminAccessBootstrap();

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const commitPage = useCallback(
    (next: AppNavPage) => {
      if (next === "faq") {
        navigate("/faq");
        setPage("faq");
        return;
      }
      setPage(next);
      if (location.pathname === "/faq") {
        navigate("/", { replace: true });
      }
    },
    [navigate, location.pathname]
  );

  useEffect(() => {
    if (location.pathname === "/faq") {
      setPage("faq");
    }
  }, [location.pathname]);

  useEffect(() => {
    const uid = getWebAppUserId();
    if (!Number.isFinite(uid) || uid <= 0) {
      setMyOrdersAttention(false);
      return;
    }
    let cancelled = false;
    const refreshAttention = () => {
      void (async () => {
        try {
          const rows = await fetchMyOrders(uid);
          if (!cancelled) setMyOrdersAttention(myOrdersNeedAttention(rows));
        } catch {
          if (!cancelled) setMyOrdersAttention(false);
        }
      })();
    };
    refreshAttention();
    const intervalId = window.setInterval(refreshAttention, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [page]);

  useEffect(() => {
    const onPop = () => {
      queueMicrotask(() => {
        if (window.location.pathname !== "/faq") {
          setPage((p) => (p === "faq" ? "home" : p));
        }
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (target: AppNavPage) => {
    commitPage(target);
    setIsMenuOpen(false);
  };

  const handleFloatingCartClick = () => {
    if (page !== "cart") {
      commitPage("cart");
    }
    setIsMenuOpen(false);
  };

  const goAdminSection = (
    section: "orders" | "products" | "categories" | "analytics" | "settings"
  ) => {
    setPage("admin");
    if (location.pathname === "/faq") {
      navigate("/", { replace: true });
    }
    const paths: Record<typeof section, string> = {
      orders: "#/admin/orders",
      products: "#/admin/products",
      categories: "#/admin/categories",
      analytics: "#/admin/analytics",
      settings: "#/admin/settings",
    };
    window.location.hash = paths[section];
    setIsMenuOpen(false);
  };

  const showHeaderAttentionDot = myOrdersAttention && page !== "my-orders";

  return (
    <div className="app">
      <Header
        menuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        attentionDot={showHeaderAttentionDot}
      />

      <SideMenu
        open={isMenuOpen}
        onClose={handleMenuClose}
        currentPage={page}
        onNavToHome={() => handleNav("home")}
        onNavToCart={() => handleNav("cart")}
        cartCount={totalQuantity}
        myOrdersAttentionDot={myOrdersAttention}
        onNavToMyOrders={() => handleNav("my-orders")}
        onNavToFaq={() => handleNav("faq")}
        onNavToConnectBot={() => handleNav("connect-bot")}
        onNavToAdmin={goAdminSection}
      />

      <div className="content app__content">
        {page === "home" && <HomePage />}
        {page === "faq" && <FAQ />}
        {page === "my-orders" && <MyOrders />}
        {page === "connect-bot" && <ConnectBotPage />}
        {page === "cart" && (
          <CartPage onGoToCheckout={() => commitPage("checkout")} />
        )}
        {page === "checkout" && (
          <CheckoutPage
            onBack={() => commitPage("cart")}
            onOrderSuccess={() => commitPage("home")}
          />
        )}
        {page === "admin" &&
          (adminAllowed ? (
            <AdminApp
              onExit={() => {
                window.location.hash = "";
                commitPage("home");
              }}
            />
          ) : (
            <div className="admin-page">
              <div className="no-access">Нет прав</div>
            </div>
          ))}
      </div>

      <FloatingCart
        visible={page !== "checkout"}
        totalQuantity={totalQuantity}
        onOpen={handleFloatingCartClick}
      />
    </div>
  );
}
