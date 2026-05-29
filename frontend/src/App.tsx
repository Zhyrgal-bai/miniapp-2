import HomePage from "./pages/HomePage";
import TableBookingPage from "./pages/TableBookingPage";
import {
  readTableQrFromLocation,
  writeTableSession,
} from "./utils/tableSessionStorage";
import { joinTableQr } from "./services/venueApi";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminApp from "./pages/admin/AdminApp";
import FAQ from "./pages/FAQ";
import AboutShopPage from "./pages/AboutShopPage";
import MyOrders from "./pages/MyOrders";
import SupportHubPage from "./pages/SupportHubPage";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useShop } from "./context/ShopContext";
import { useAdminGateStore } from "./store/adminGate.store";
import { useCartStore } from "./store/useCartStore";
import { useAdminPanelVisible, useAdminAccessBootstrap } from "@/utils/admin";
import { fetchMyOrders } from "./services/myOrdersApi";
import { getWebAppUserId } from "./utils/telegramUserId";
import { getTelegramWebApp } from "./utils/telegram";
import { ensureTelegramMobileUx } from "./utils/telegramWebAppBootstrap";
import { resetBodyScrollLock } from "./utils/bodyScrollLock";
import {
  clearPendingFinikOrder,
} from "./utils/pendingFinikOrder";
import { FINIK_PAYMENT_PAID_EVENT } from "./utils/finikPaymentEvents";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import {
  mergeTenantIntoLocation,
  parseStoreSlugFromPath,
  readStoreSlugString,
} from "./utils/storeParams";
import type { MyOrderRow } from "./types/myOrder";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import {
  SF_ADMIN_SUPPORT_TAB_KEY,
  SF_ORDERS_INTENT_KEY,
  type AdminSupportTabIntent,
} from "./utils/accountMenuStorage";
import SideMenu from "./components/layout/SideMenu";
import { PreorderProvider } from "./context/PreorderContext";
import { PreorderBanner } from "./components/tableBooking/PreorderBanner";
import PaymentProcessingBanner from "./components/checkout/PaymentProcessingBanner";
import ToastHost from "./components/ui/ToastHost";
import FloatingCart from "./components/layout/FloatingCart";
import { StickyCartBar } from "./components/storefront/cart/StickyCartBar";
import "./components/storefront/cart/stickyCart.css";
import { ThemeVarsProvider } from "./components/storefront/theme/ThemeVarsProvider";
import { useTheme } from "./context/ThemeContext";
import { useStorefrontPayload } from "./components/storefront/runtime/StorefrontPayloadContext";
import TenantBootScreen from "./components/ui/TenantBootScreen";
import {
  buildStorefrontLayoutCssVars,
  kitFromTemplateId,
  storefrontShellModeFromStyleConfig,
} from "./storefront/buildStorefrontLayoutCssVars";

type AppNavPage =
  | "home"
  | "cart"
  | "checkout"
  | "admin"
  | "faq"
  | "about-shop"
  | "my-orders"
  | "support"
  | "table-booking";

function myOrdersNeedAttention(rows: MyOrderRow[]): boolean {
  return rows.some((o) => {
    const s = String(o.status).toUpperCase();
    return s === "ACCEPTED" || s === "PAID_PENDING";
  });
}

function initialPageFromPath(): AppNavPage {
  if (typeof window === "undefined") return "home";
  if (window.location.pathname === "/faq") return "faq";
  if (window.location.pathname === "/about") return "about-shop";
  return "home";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { businessId, shopIdString } = useShop();
  const { theme, templateId } = useTheme();
  const { payload, loading: storefrontLoading, error: storefrontError, refresh: refreshStorefront } = useStorefrontPayload();

  const storeDisplayName = payload?.storeName?.trim() || "";
  const storeBrandHeader = storeDisplayName !== "";
  const [page, setPage] = useState<AppNavPage>(initialPageFromPath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [myOrdersAttention, setMyOrdersAttention] = useState(false);
  /** Вход «Мои заказы» из профиля — сброс баннера. */
  const [myOrdersPlainNonce, setMyOrdersPlainNonce] = useState(0);
  const [adminByHash, setAdminByHash] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.hash.startsWith("#/admin")
  );
  const adminAllowed = useAdminPanelVisible();
  const refreshAdminGate = useAdminGateStore((s) => s.refresh);
  useAdminAccessBootstrap();

  useEffect(() => {
    void refreshAdminGate(businessId ?? undefined);
  }, [businessId, refreshAdminGate]);

  useEffect(() => {
    const qr = readTableQrFromLocation();
    if (!qr) return;
    void (async () => {
      try {
        const joined = await joinTableQr(qr);
        writeTableSession({
          businessId: joined.businessId,
          tableSessionId: joined.tableSessionId,
          tableName: joined.tableName,
          qrToken: qr,
        });
        if (typeof window !== "undefined") {
          const u = new URL(window.location.href);
          u.searchParams.delete("tableQr");
          window.history.replaceState({}, "", u.pathname + u.search);
        }
      } catch {
        /* ignore invalid QR */
      }
    })();
  }, []);

  useEffect(() => {
    resetBodyScrollLock();
    ensureTelegramMobileUx();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        resetBodyScrollLock();
        ensureTelegramMobileUx();
        void refreshAdminGate(businessId ?? undefined);
        window.dispatchEvent(new CustomEvent("sf:paymentPollTick"));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [businessId, refreshAdminGate]);

  const tenantNav = useMemo(() => {
    if (!shopIdString) {
      const s = location.search.trim();
      return { pathname: location.pathname, search: s && s !== "?" ? s : "" };
    }
    return mergeTenantIntoLocation({
      pathname: location.pathname,
      rawSearch: location.search ?? "",
      shopIdString,
      storefrontSlug: payload?.storefrontSlug ?? null,
    });
  }, [shopIdString, location.pathname, location.search, payload?.storefrontSlug]);

  const tenantMergedSearch = tenantNav.search;

  useEffect(() => {
    const onHash = () =>
      setAdminByHash(window.location.hash.startsWith("#/admin"));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const allowWithoutShop =
    page === "admin" || adminByHash || page === "faq";
  const slugPath = parseStoreSlugFromPath(location.pathname);
  const slugHint = readStoreSlugString(location.pathname, location.search);
  const tenantBoot =
    !allowWithoutShop &&
    businessId == null &&
    (storefrontLoading || (Boolean(slugHint) && storefrontError == null));
  const shopMissing = !allowWithoutShop && businessId == null && !tenantBoot;

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const sfAppRef = useRef<HTMLDivElement | null>(null);
  const [stickyCartHeight, setStickyCartHeight] = useState(0);
  const [productSheetOpen, setProductSheetOpen] = useState(false);

  useLayoutEffect(() => {
    const stickyVisible = page === "home" && totalQuantity > 0;
    if (!stickyVisible) {
      setStickyCartHeight(0);
      sfAppRef.current?.style.setProperty("--sf-chrome-sticky-height", "0px");
      return;
    }
    const measure = () => {
      const el = document.querySelector(".sf-sticky-cart");
      const h = el instanceof HTMLElement ? Math.ceil(el.getBoundingClientRect().height) : 0;
      const next = h > 0 ? h + 10 : 82;
      setStickyCartHeight(next);
      sfAppRef.current?.style.setProperty("--sf-chrome-sticky-height", `${next}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(".sf-sticky-cart");
    if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 120);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [page, totalQuantity]);

  useEffect(() => {
    const onOpen = () => setProductSheetOpen(true);
    const onClose = () => setProductSheetOpen(false);
    window.addEventListener("sf:productSheetOpen", onOpen as EventListener);
    window.addEventListener("sf:productSheetClose", onClose as EventListener);
    return () => {
      window.removeEventListener("sf:productSheetOpen", onOpen as EventListener);
      window.removeEventListener("sf:productSheetClose", onClose as EventListener);
    };
  }, []);

  const sfKit = kitFromTemplateId(templateId ?? payload?.templateId ?? null);

  const sfVars = useMemo(
    () =>
      buildStorefrontLayoutCssVars(
        (payload?.storefrontStyleConfig ?? null) as Record<string, unknown> | null,
      ),
    [payload?.storefrontStyleConfig],
  );

  const commerceShellMode = useMemo(
    () =>
      storefrontShellModeFromStyleConfig(
        (payload?.storefrontStyleConfig ?? null) as Record<string, unknown> | null,
      ),
    [payload?.storefrontStyleConfig],
  );

  const commitPage = useCallback(
    (next: AppNavPage) => {
      if (next === "faq") {
        if (shopIdString) {
          navigate(
            mergeTenantIntoLocation({
              pathname: "/faq",
              rawSearch: location.search ?? "",
              shopIdString,
              storefrontSlug: payload?.storefrontSlug ?? null,
            }),
          );
        } else {
          navigate({ pathname: "/faq", search: location.search });
        }
        setPage("faq");
        return;
      }
      if (next === "about-shop") {
        if (shopIdString) {
          navigate(
            mergeTenantIntoLocation({
              pathname: "/about",
              rawSearch: location.search ?? "",
              shopIdString,
              storefrontSlug: payload?.storefrontSlug ?? null,
            }),
          );
        } else {
          navigate({ pathname: "/about", search: location.search });
        }
        setPage("about-shop");
        return;
      }
      setPage(next);
      if (location.pathname === "/faq" || location.pathname === "/about") {
        if (shopIdString) {
          navigate(
            mergeTenantIntoLocation({
              pathname: "/",
              rawSearch: tenantMergedSearch || "",
              shopIdString,
              storefrontSlug: payload?.storefrontSlug ?? null,
            }),
            { replace: true },
          );
        } else {
          navigate(
            {
              pathname: "/",
              search:
                tenantMergedSearch && tenantMergedSearch !== "?"
                  ? tenantMergedSearch
                  : "",
            },
            { replace: true },
          );
        }
      }
    },
    [
      navigate,
      location.pathname,
      location.search,
      tenantMergedSearch,
      shopIdString,
      payload?.storefrontSlug,
    ],
  );

  useEffect(() => {
    if (location.pathname === "/faq") {
      setPage("faq");
    } else if (location.pathname === "/about") {
      setPage("about-shop");
    }
  }, [location.pathname]);

  /** Диплинк из Telegram: `view=my-orders` | Mini App «Настройки» из личного кабинета. */
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const v = sp.get("view");
    if (v === "my-orders") {
      commitPage("my-orders");
      return;
    }
    if (v === "support") {
      commitPage("support");
      return;
    }
    if (v === "merchant-settings") {
      setPage("admin");
      window.location.hash = "#/admin/design";
      if (location.pathname === "/faq" || location.pathname === "/about") {
        if (shopIdString) {
          navigate(
            mergeTenantIntoLocation({
              pathname: "/",
              rawSearch: tenantMergedSearch || "",
              shopIdString,
              storefrontSlug: payload?.storefrontSlug ?? null,
            }),
            { replace: true },
          );
        } else {
          navigate(
            {
              pathname: "/",
              search:
                tenantMergedSearch && tenantMergedSearch !== "?"
                  ? tenantMergedSearch
                  : "",
            },
            { replace: true },
          );
        }
      }
      return;
    }
    // Не открываем экран регистрации бота в витрине: старые ссылки ?view=connect-bot из BotFather
    // вели всех покупателей на форму токена. Сбрасываем на главную витрины.
    if (v === "connect-bot") {
      const sp2 = new URLSearchParams(location.search);
      sp2.delete("view");
      const qs = sp2.toString();
      const rawSearch = qs ? `?${qs}` : "";
      if (shopIdString && location.pathname === "/faq") {
        navigate(
          mergeTenantIntoLocation({
            pathname: "/",
            rawSearch,
            shopIdString,
            storefrontSlug: payload?.storefrontSlug ?? null,
          }),
          { replace: true },
        );
      } else {
        navigate(
          {
            pathname: location.pathname === "/faq" ? "/" : location.pathname,
            search: qs ? `?${qs}` : "",
          },
          { replace: true },
        );
      }
      setPage("home");
    }
  }, [
    location.search,
    commitPage,
    location.pathname,
    navigate,
    tenantMergedSearch,
    shopIdString,
    payload?.storefrontSlug,
  ]);

  useEffect(() => {
    const uid = getWebAppUserId();
    if (!Number.isFinite(uid) || uid <= 0 || businessId == null) {
      setMyOrdersAttention(false);
      return;
    }
    let cancelled = false;
    const refreshAttention = () => {
      void (async () => {
        try {
          const rows = await fetchMyOrders(uid, String(businessId));
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
  }, [page, businessId]);

  /** После оплаты Finik: очистка pending и переход на главную. */
  useEffect(() => {
    const onPaid = () => {
      clearPendingFinikOrder();
      useCartStore.getState().clearCart();
      commitPage("home");
    };
    window.addEventListener(FINIK_PAYMENT_PAID_EVENT, onPaid as EventListener);
    return () =>
      window.removeEventListener(FINIK_PAYMENT_PAID_EVENT, onPaid as EventListener);
  }, [commitPage]);

  useEffect(() => {
    const onPop = () => {
      queueMicrotask(() => {
        const path = window.location.pathname;
        if (path !== "/faq" && path !== "/about") {
          setPage((p) =>
            p === "faq" || p === "about-shop" ? "home" : p,
          );
        }
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);
  
  // Storefront header (customer-facing) toggles SideMenu via safe event (no prop drilling).
  useEffect(() => {
    const onToggle = () => handleMenuToggle();
    window.addEventListener("sf:toggleMenu", onToggle as unknown as EventListener);
    return () =>
      window.removeEventListener("sf:toggleMenu", onToggle as unknown as EventListener);
  }, []);

  useEffect(() => {
    const onOpenSupport = () => {
      commitPage("support");
      setIsMenuOpen(false);
    };
    window.addEventListener("sf:openSupport", onOpenSupport as EventListener);
    return () =>
      window.removeEventListener("sf:openSupport", onOpenSupport as EventListener);
  }, [commitPage]);

  useEffect(() => {
    const onOpenBooking = () => {
      commitPage("table-booking");
      setIsMenuOpen(false);
    };
    window.addEventListener("sf:openTableBooking", onOpenBooking as EventListener);
    return () =>
      window.removeEventListener("sf:openTableBooking", onOpenBooking as EventListener);
  }, [commitPage]);

  const handleNav = (target: AppNavPage) => {
    commitPage(target);
    setIsMenuOpen(false);
  };

  const handleTelegramBack = useCallback(() => {
    if (page === "admin" || adminByHash) {
      window.location.hash = "";
      commitPage("home");
      return;
    }
    if (page === "checkout") {
      commitPage("cart");
      return;
    }
    if (page === "cart") {
      commitPage("home");
      return;
    }
    if (page === "table-booking") {
      commitPage("home");
      return;
    }
    if (page !== "home") {
      commitPage("home");
    }
  }, [page, adminByHash, commitPage]);

  useTelegramBackButton(page !== "home", handleTelegramBack);

  const handleFloatingCartClick = () => {
    if (page !== "cart") {
      commitPage("cart");
    }
    setIsMenuOpen(false);
  };

  const handleCheckoutQuick = () => {
    if (page !== "checkout") {
      commitPage("checkout");
    }
    setIsMenuOpen(false);
  };

  const goAdminSection = (
    section:
      | "orders"
      | "products"
      | "categories"
      | "analytics"
      | "design"
      | "promos"
      | "support"
  ) => {
    setPage("admin");
    if (location.pathname === "/faq" || location.pathname === "/about") {
      if (shopIdString) {
        navigate(
          mergeTenantIntoLocation({
            pathname: "/",
            rawSearch: tenantMergedSearch || "",
            shopIdString,
            storefrontSlug: payload?.storefrontSlug ?? null,
          }),
          { replace: true },
        );
      } else {
        navigate(
          {
            pathname: "/",
            search:
              tenantMergedSearch && tenantMergedSearch !== "?"
                ? tenantMergedSearch
                : "",
          },
          { replace: true },
        );
      }
    }
    const paths: Record<typeof section, string> = {
      orders: "#/admin/orders",
      design: "#/admin/design",
      products: "#/admin/products",
      categories: "#/admin/categories",
      promos: "#/admin/promos",
      analytics: "#/admin/analytics",
      support: "#/admin/support",
    };
    window.location.hash = paths[section];
    setIsMenuOpen(false);
  };

  const openAdminSupportTab = (tab: AdminSupportTabIntent) => {
    sessionStorage.setItem(SF_ADMIN_SUPPORT_TAB_KEY, tab);
    goAdminSection("support");
  };

  const showHeaderAttentionDot =
    myOrdersAttention && page !== "my-orders" && businessId != null;

  useEffect(() => {
    if (!shopIdString || !payload?.storefrontSlug) return;
    if (slugPath) return;
    const sp = new URLSearchParams(location.search);
    if (!sp.has("shop") && !sp.has("businessId")) return;
    const slug = String(payload.storefrontSlug).trim();
    if (!slug) return;
    navigate({ pathname: `/store/${encodeURIComponent(slug)}`, search: "" }, { replace: true });
  }, [shopIdString, payload?.storefrontSlug, location.search, location.pathname, navigate, slugPath]);

  if (tenantBoot) {
    return (
      <ThemeVarsProvider theme={theme}>
        <div className="app app--tenant-loading" role="status">
          <TenantBootScreen
            message={storefrontError ?? undefined}
            onRetry={() => void refreshStorefront()}
          />
        </div>
      </ThemeVarsProvider>
    );
  }

  if (shopMissing) {
    const openViaTelegram = () => {
      const tg = getTelegramWebApp();
      const close = (tg as { close?: () => void } | undefined)?.close;
      if (typeof close === "function") {
        close();
      } else {
        window.location.reload();
      }
    };
    return (
      <div className="app app--shop-missing">
        <div className="shop-missing" role="alert">
          <p className="shop-missing__title">Не удалось открыть витрину</p>
          <p className="shop-missing__hint">
            Откройте Mini App через кнопку «Открыть» в Telegram. Старые ссылки{" "}
            <code className="shop-missing__code">?shop=ID</code> /{" "}
            <code className="shop-missing__code">?businessId=ID</code> поддерживаются и будут
            автоматически перенаправлены.
          </p>
          {storefrontError ? (
            <p className="shop-missing__hint" style={{ marginTop: 6 }}>
              {storefrontError}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="checkout-btn" onClick={() => void refreshStorefront()}>
              Повторить
            </button>
            <button type="button" className="checkout-btn" onClick={() => window.location.reload()}>
              Обновить
            </button>
            <button type="button" className="go-shop" onClick={openViaTelegram}>
              Открыть через Telegram
            </button>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <PreorderProvider businessId={businessId}>
    <div className={`app${storeBrandHeader ? " app--store-brand" : ""}`}>
      <Header
        menuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        attentionDot={showHeaderAttentionDot}
        ordersAttentionDot={myOrdersAttention}
        title={storeDisplayName || undefined}
        storeName={storeDisplayName || undefined}
        logoUrl={theme.logoUrl}
        storeBrandMode={storeBrandHeader}
        isMerchantStaff={adminAllowed}
        accountMenu={{
          onGoToStore: () => handleNav("home"),
          onMyOrders: () => {
            sessionStorage.removeItem(SF_ORDERS_INTENT_KEY);
            setMyOrdersPlainNonce((n) => n + 1);
            handleNav("my-orders");
          },
          onOpenSupportHub: () => handleNav("support"),
        }}
        merchantMenu={
          adminAllowed
            ? {
                onCustomerSupport: () => openAdminSupportTab("tickets"),
                onReturns: () => openAdminSupportTab("returns"),
                onTickets: () => openAdminSupportTab("tickets"),
                onSupportAnalytics: () => goAdminSection("analytics"),
              }
            : undefined
        }
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
        onNavToSupport={() => handleNav("support")}
        onNavToFaq={() => handleNav("faq")}
        onNavToTableBooking={() => handleNav("table-booking")}
        onNavToAdmin={goAdminSection}
      />

      <PaymentProcessingBanner
        businessId={businessId}
        onViewOrders={() => handleNav("my-orders")}
      />

      <div className="content app__content">
        <div className="sf-commerce-shell" data-sf-shell={commerceShellMode}>
          {(page === "home" || page === "cart" || page === "checkout") && (
            <PreorderBanner />
          )}
          {page === "home" && <HomePage />}
          {page === "table-booking" && (
            <TableBookingPage onBack={() => commitPage("home")} />
          )}
          {page === "faq" && <FAQ />}
          {page === "about-shop" && <AboutShopPage />}
          {page === "my-orders" && (
            <MyOrders profilePlainNonce={myOrdersPlainNonce} />
          )}
          {page === "support" && (
            <SupportHubPage
              onBack={() => commitPage("home")}
              onGoShopping={() => commitPage("home")}
            />
          )}
          {page === "cart" && (
            <CartPage onGoToCheckout={() => commitPage("checkout")} />
          )}
          {page === "checkout" && (
            <CheckoutPage onBack={() => commitPage("cart")} />
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
      </div>

      <FloatingCart
        visible={
          !productSheetOpen &&
          page !== "support" &&
          page !== "checkout" &&
          page !== "table-booking" &&
          !(page === "home" && totalQuantity > 0)
        }
        totalQuantity={totalQuantity}
        onOpen={handleFloatingCartClick}
        bottomInsetPx={stickyCartHeight}
      />

      <StickyCartBar
        visible={page === "home" && !productSheetOpen}
        onOpenCart={handleFloatingCartClick}
        onCheckout={handleCheckoutQuick}
      />
      <ToastHost />
    </div>
    </PreorderProvider>
  );
  return (
    <ThemeVarsProvider theme={theme}>
      <div
        ref={sfAppRef}
        data-sf-kit={sfKit}
        data-sf-scroll-root=""
        className="sf-root sf-app"
        data-sf-store-brand={storeBrandHeader ? "1" : undefined}
        data-sf-product-sheet={productSheetOpen ? "open" : undefined}
        style={sfVars as unknown as React.CSSProperties}
      >
        <div id="sf-theme-portal-root" data-sf-portal-host />
        {content}
      </div>
    </ThemeVarsProvider>
  );
}
