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
import FavoritesPage from "./pages/FavoritesPage";
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
  canonicalStorePath,
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
import { ARCHA_BRAND } from "./config/brandAssets";
import TenantBootScreen from "./components/ui/TenantBootScreen";
import StoreNotFoundScreen from "./components/storefront/runtime/StoreNotFoundScreen";
import {
  buildStorefrontLayoutCssVars,
  kitFromTemplateId,
  storefrontShellModeFromStyleConfig,
} from "./storefront/buildStorefrontLayoutCssVars";
import { isStorefrontCommerceEnabled } from "./hooks/useStorefrontCommerceMode";
import { useCustomerLocationPrompt } from "./hooks/useCustomerLocationPrompt";
import { CustomerLocationPrompt } from "./components/storefront/commerce/CustomerLocationPrompt";
import { OpenInTelegramModal } from "./components/storefront/commerce/OpenInTelegramModal";
import { StoreProfileSheet } from "./components/storefront/StoreProfileSheet";
import { extractStoreProfileContacts } from "./storefront/storeProfileContacts";
import { openOpenInTelegramModal } from "./storefront/openInTelegramModal";

type AppNavPage =
  | "home"
  | "cart"
  | "checkout"
  | "admin"
  | "faq"
  | "about-shop"
  | "favorites"
  | "my-orders"
  | "support"
  | "table-booking";

const WEB_BLOCKED_NAV_PAGES = new Set<AppNavPage>([
  "cart",
  "checkout",
  "my-orders",
  "support",
  "table-booking",
]);

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
  const { payload, loading: storefrontLoading, error: storefrontError, storeNotFound, refresh: refreshStorefront } = useStorefrontPayload();

  const storeDisplayName = payload?.storeName?.trim() || "";
  const storeBrandHeader = storeDisplayName !== "";

  useEffect(() => {
    document.title = storeDisplayName
      ? `${storeDisplayName} · ${ARCHA_BRAND.name}`
      : ARCHA_BRAND.title;
  }, [storeDisplayName]);
  const [page, setPage] = useState<AppNavPage>(initialPageFromPath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [storeProfileOpen, setStoreProfileOpen] = useState(false);
  const [storeProfileSection, setStoreProfileSection] = useState<
    "delivery" | "schedule" | null
  >(null);
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

  const commerceEnabled = isStorefrontCommerceEnabled();

  const customerLocationPrompt = useCustomerLocationPrompt(
    businessId != null && !tenantBoot && !shopMissing ? businessId : null,
  );

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  useEffect(() => {
    if (!commerceEnabled && (page === "cart" || page === "checkout" || page === "my-orders" || page === "support" || page === "table-booking")) {
      setPage("home");
    }
  }, [commerceEnabled, page]);

  const sfAppRef = useRef<HTMLDivElement | null>(null);
  const [stickyCartHeight, setStickyCartHeight] = useState(0);
  const [productSheetOpen, setProductSheetOpen] = useState(false);

  useLayoutEffect(() => {
    const stickyVisible = commerceEnabled && page === "home" && totalQuantity > 0;
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
  }, [page, totalQuantity, commerceEnabled]);

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
      if (
        !isStorefrontCommerceEnabled() &&
        WEB_BLOCKED_NAV_PAGES.has(next)
      ) {
        openOpenInTelegramModal(payload?.telegramOpenUrl ?? null);
        return;
      }
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
      payload?.telegramOpenUrl,
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

  useEffect(() => {
    const onOpenProfile = (ev: Event) => {
      const detail = (ev as CustomEvent<{ section?: "delivery" | "schedule" }>).detail;
      setStoreProfileSection(detail?.section ?? null);
      setStoreProfileOpen(true);
      setIsMenuOpen(false);
    };
    window.addEventListener("sf:openStoreProfile", onOpenProfile as EventListener);
    return () =>
      window.removeEventListener("sf:openStoreProfile", onOpenProfile as EventListener);
  }, []);

  const openStoreProfile = useCallback((section?: "delivery" | "schedule") => {
    setStoreProfileSection(section ?? null);
    setStoreProfileOpen(true);
    setIsMenuOpen(false);
  }, []);

  const storeProfileContacts = useMemo(
    () => extractStoreProfileContacts(payload?.sections),
    [payload?.sections],
  );

  const handleNav = (target: AppNavPage) => {
    commitPage(target);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const onNavigateCart = () => {
      window.dispatchEvent(new CustomEvent("sf:productSheetClose"));
      commitPage("cart");
      setIsMenuOpen(false);
    };
    window.addEventListener("sf:navigateCart", onNavigateCart as EventListener);
    return () =>
      window.removeEventListener("sf:navigateCart", onNavigateCart as EventListener);
  }, [commitPage]);

  const handleTelegramBack = useCallback(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    if (productSheetOpen) {
      window.dispatchEvent(new CustomEvent("sf:productSheetClose"));
      return;
    }
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
    if (page === "table-booking" || page === "favorites") {
      commitPage("home");
      return;
    }
    if (storeProfileOpen) {
      setStoreProfileOpen(false);
      return;
    }
    if (page !== "home") {
      commitPage("home");
    }
  }, [page, adminByHash, commitPage, storeProfileOpen, isMenuOpen, productSheetOpen]);

  useTelegramBackButton(
    page !== "home" || storeProfileOpen || isMenuOpen || productSheetOpen,
    handleTelegramBack,
  );

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
    sp.delete("shop");
    sp.delete("businessId");
    const qs = sp.toString();
    navigate(
      { pathname: canonicalStorePath(slug), search: qs ? `?${qs}` : "" },
      { replace: true },
    );
  }, [shopIdString, payload?.storefrontSlug, location.search, location.pathname, navigate, slugPath]);

  useEffect(() => {
    const slug =
      payload?.storefrontSlug != null && String(payload.storefrontSlug).trim() !== ""
        ? String(payload.storefrontSlug).trim()
        : null;
    if (slug == null) return;
    const href = `${window.location.origin}${canonicalStorePath(slug)}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [payload?.storefrontSlug]);

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

  if (storeNotFound && slugHint) {
    return (
      <StoreNotFoundScreen
        slug={slugHint}
        message={storefrontError}
        onRetry={() => void refreshStorefront()}
      />
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
            автоматически перенаправлены на{" "}
            <code className="shop-missing__code">/s/slug</code>.
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
    <div
      className={`app${storeBrandHeader ? " app--store-brand" : ""}${commerceEnabled ? "" : " app--web-storefront"}`}
      data-sf-commerce={commerceEnabled ? "telegram" : "web"}
    >
      {!productSheetOpen ? (
      <Header
        menuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        attentionDot={showHeaderAttentionDot}
        ordersAttentionDot={myOrdersAttention}
        title={storeDisplayName || undefined}
        storeName={storeDisplayName || undefined}
        logoUrl={theme.logoUrl}
        storeBrandMode={storeBrandHeader}
        onOpenStoreProfile={
          commerceEnabled && storeBrandHeader
            ? () => openStoreProfile()
            : undefined
        }
        isMerchantStaff={adminAllowed}
        accountMenu={
          commerceEnabled
            ? {
                onGoToStore: () => handleNav("home"),
                onMyOrders: () => {
                  sessionStorage.removeItem(SF_ORDERS_INTENT_KEY);
                  setMyOrdersPlainNonce((n) => n + 1);
                  handleNav("my-orders");
                },
                onOpenSupportHub: () => handleNav("support"),
              }
            : undefined
        }
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
      ) : null}

      <SideMenu
        open={isMenuOpen}
        onClose={handleMenuClose}
        currentPage={page}
        onNavToHome={() => handleNav("home")}
        onNavToCart={() => handleNav("cart")}
        cartCount={totalQuantity}
        myOrdersAttentionDot={myOrdersAttention}
        onNavToMyOrders={() => handleNav("my-orders")}
        onNavToFavorites={() => handleNav("favorites")}
        onNavToSupport={() => handleNav("support")}
        onNavToAbout={() => handleNav("about-shop")}
        onNavToFaq={() => handleNav("faq")}
        onOpenStoreProfile={openStoreProfile}
        onNavToTableBooking={() => handleNav("table-booking")}
        onNavToAdmin={goAdminSection}
      />

      {commerceEnabled ? (
        <PaymentProcessingBanner
          businessId={businessId}
          onViewOrders={() => handleNav("my-orders")}
        />
      ) : null}

      <div className="content app__content">
        <div className="sf-commerce-shell" data-sf-shell={commerceShellMode}>
          {commerceEnabled &&
          (page === "home" || page === "cart" || page === "checkout") &&
          !productSheetOpen ? (
            <PreorderBanner />
          ) : null}
          {page === "home" && <HomePage />}
          {commerceEnabled && page === "table-booking" && (
            <TableBookingPage onBack={() => commitPage("home")} />
          )}
          {page === "faq" && <FAQ />}
          {page === "about-shop" && <AboutShopPage />}
          {commerceEnabled && page === "favorites" && <FavoritesPage />}
          {commerceEnabled && page === "my-orders" && (
            <MyOrders profilePlainNonce={myOrdersPlainNonce} />
          )}
          {commerceEnabled && page === "support" && (
            <SupportHubPage
              onBack={() => commitPage("home")}
              onGoShopping={() => commitPage("home")}
            />
          )}
          {commerceEnabled && page === "cart" && (
            <CartPage onGoToCheckout={() => commitPage("checkout")} />
          )}
          {commerceEnabled && page === "checkout" && (
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

      {commerceEnabled ? (
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
      ) : null}

      {commerceEnabled ? (
        <StickyCartBar
          visible={page === "home" && !productSheetOpen}
          onOpenCart={handleFloatingCartClick}
          onCheckout={handleCheckoutQuick}
        />
      ) : null}
      <ToastHost />
      <CustomerLocationPrompt
        open={customerLocationPrompt.promptVisible}
        requesting={customerLocationPrompt.requesting}
        error={customerLocationPrompt.requestError}
        storeName={storeDisplayName || null}
        onAllow={customerLocationPrompt.onAllow}
        onDismiss={customerLocationPrompt.onDismiss}
      />
      {commerceEnabled ? (
        <StoreProfileSheet
          open={storeProfileOpen}
          onClose={() => {
            setStoreProfileOpen(false);
            setStoreProfileSection(null);
          }}
          storeName={storeDisplayName || undefined}
          logoUrl={theme.logoUrl}
          storeAddress={payload?.storeAddress}
          availability={payload?.storeAvailability ?? null}
          textConfig={payload?.storefrontTextConfig ?? undefined}
          contacts={storeProfileContacts}
          initialSection={storeProfileSection}
          onOpenSupport={() => handleNav("support")}
          onOpenAbout={() => handleNav("about-shop")}
          onOpenFaq={() => handleNav("faq")}
        />
      ) : null}
      <OpenInTelegramModal
        defaultTelegramOpenUrl={payload?.telegramOpenUrl ?? null}
      />
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
