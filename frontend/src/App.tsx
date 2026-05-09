import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminApp from "./pages/admin/AdminApp";
import FAQ from "./pages/FAQ";
import MyOrders from "./pages/MyOrders";
import ConnectBotPage from "./pages/ConnectBotPage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useShop } from "./context/ShopContext";
import { useAdminGateStore } from "./store/adminGate.store";
import { useCartStore } from "./store/useCartStore";
import { useAdminPanelVisible, useAdminAccessBootstrap } from "@/utils/admin";
import { fetchMyOrders } from "./services/myOrdersApi";
import { getWebAppUserId } from "./utils/telegramUserId";
import { mergeTenantShopIntoSearch } from "./utils/storeParams";
import type { MyOrderRow } from "./types/myOrder";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";
import { StickyCartBar } from "./components/storefront/cart/StickyCartBar";
import "./components/storefront/cart/stickyCart.css";
import { ThemeVarsProvider } from "./components/storefront/theme/ThemeVarsProvider";
import { useTheme } from "./context/ThemeContext";
import { useStorefrontPayload } from "./components/storefront/runtime/StorefrontPayloadContext";
import { FONT_ALLOWLIST, isFontId } from "./themeStudio/fonts";

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
  const { businessId, shopIdString } = useShop();
  const { theme, templateId } = useTheme();
  const { payload } = useStorefrontPayload();
  const [page, setPage] = useState<AppNavPage>(initialPageFromPath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [myOrdersAttention, setMyOrdersAttention] = useState(false);
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

  const tenantMergedSearch = useMemo(() => {
    if (!shopIdString) {
      const s = location.search.trim();
      return s && s !== "?" ? s : "";
    }
    return mergeTenantShopIntoSearch(location.search ?? "", shopIdString);
  }, [shopIdString, location.search]);

  useEffect(() => {
    const onHash = () =>
      setAdminByHash(window.location.hash.startsWith("#/admin"));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const allowWithoutShop =
    page === "admin" ||
    adminByHash ||
    page === "connect-bot" ||
    page === "faq";
  const shopMissing = !allowWithoutShop && businessId == null;

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const isStorefrontUi =
    page === "home" || page === "cart" || page === "checkout" || page === "my-orders" || page === "faq";

  const kitFromTemplateId = (tid: string | null | undefined): string => {
    const t = typeof tid === "string" ? tid.trim().toLowerCase() : "";
    if (t === "minimal" || t === "light") return "minimal";
    if (t === "luxury") return "luxury";
    if (t === "fashion") return "fashion";
    if (t === "neon") return "neon";
    return "default";
  };
  const sfKit = kitFromTemplateId(templateId ?? payload?.templateId ?? null);

  const styleCfg = (payload?.storefrontStyleConfig ?? {}) as Record<string, unknown>;
  const layout =
    styleCfg.layout && typeof styleCfg.layout === "object" && !Array.isArray(styleCfg.layout)
      ? (styleCfg.layout as Record<string, unknown>)
      : {};
  const typo =
    styleCfg.typography && typeof styleCfg.typography === "object" && !Array.isArray(styleCfg.typography)
      ? (styleCfg.typography as Record<string, unknown>)
      : {};
  const chips =
    styleCfg.chips && typeof styleCfg.chips === "object" && !Array.isArray(styleCfg.chips)
      ? (styleCfg.chips as Record<string, unknown>)
      : {};
  const buttons =
    styleCfg.buttons && typeof styleCfg.buttons === "object" && !Array.isArray(styleCfg.buttons)
      ? (styleCfg.buttons as Record<string, unknown>)
      : {};
  const hero =
    styleCfg.hero && typeof styleCfg.hero === "object" && !Array.isArray(styleCfg.hero)
      ? (styleCfg.hero as Record<string, unknown>)
      : {};
  const cart =
    styleCfg.cart && typeof styleCfg.cart === "object" && !Array.isArray(styleCfg.cart)
      ? (styleCfg.cart as Record<string, unknown>)
      : {};
  const drawer =
    styleCfg.drawer && typeof styleCfg.drawer === "object" && !Array.isArray(styleCfg.drawer)
      ? (styleCfg.drawer as Record<string, unknown>)
      : {};

  const fontStack = (id: unknown): string => {
    const v = isFontId(id) ? id : "system";
    const found = FONT_ALLOWLIST.find((f) => f.id === v);
    return found?.cssFamily ?? FONT_ALLOWLIST[0].cssFamily;
  };

  const densityScale =
    layout.density === "compact" ? 0.86 : layout.density === "comfortable" ? 1.14 : 1;

  const scaledPx = (v: unknown): string => {
    if (typeof v !== "number" || !Number.isFinite(v)) return "";
    return `${Math.round(v * densityScale)}px`;
  };

  const contentMax =
    layout.contentWidth === "narrow"
      ? "430px"
      : "100%";

  const sfVars: Record<string, string> = {
    "--sf-density-scale": String(densityScale),
    "--sf-content-max": contentMax,
    "--sf-section-pad": scaledPx(layout.sectionSpacing) || (typeof layout.sectionSpacing === "number" ? `${layout.sectionSpacing}px` : ""),
    "--sf-grid-gap": scaledPx(layout.productGap) || (typeof layout.productGap === "number" ? `${layout.productGap}px` : ""),
    "--sf-mobile-pad": scaledPx(layout.mobilePadding) || (typeof layout.mobilePadding === "number" ? `${layout.mobilePadding}px` : ""),
    "--sf-font-body": fontStack(typo.fontBody),
    "--sf-font-heading": fontStack(typo.fontTitle),
    "--sf-font-button": fontStack(typo.fontButton),
    "--sf-typo-title-size": typeof typo.titleSize === "number" ? `${typo.titleSize}px` : "",
    "--sf-typo-section-title-size": typeof typo.sectionTitleSize === "number" ? `${typo.sectionTitleSize}px` : "",
    "--sf-typo-button-size": typeof typo.buttonSize === "number" ? `${typo.buttonSize}px` : "",
    "--sf-typo-title-weight": typeof typo.titleWeight === "number" ? String(typo.titleWeight) : "",
    "--sf-typo-title-transform":
      typeof typo.uppercaseTitles === "boolean" ? (typo.uppercaseTitles ? "uppercase" : "none") : "",
    "--sf-typo-title-letter-spacing": typeof typo.letterSpacing === "number" ? `${typo.letterSpacing}em` : "",
    "--sf-typo-title-line-height": typeof typo.lineHeight === "number" ? String(typo.lineHeight) : "",
    "--sf-chip-radius": typeof chips.radius === "number" ? `${chips.radius}px` : "",
    "--sf-chip-gap": scaledPx(chips.gap) || (typeof chips.gap === "number" ? `${chips.gap}px` : ""),
    "--sf-chip-shape": typeof chips.shape === "string" ? String(chips.shape) : "",
    "--sf-chip-style": typeof chips.style === "string" ? String(chips.style) : "",
    "--sf-chip-size": typeof chips.size === "string" ? String(chips.size) : "",
    "--sf-button-radius": typeof buttons.radius === "number" ? `${buttons.radius}px` : "",
    "--sf-button-height": typeof buttons.height === "number" ? `${buttons.height}px` : "",
    "--sf-button-variant": typeof buttons.variant === "string" ? String(buttons.variant) : "",
    "--sf-button-shadow-enabled":
      typeof buttons.shadow === "boolean" ? (buttons.shadow ? "1" : "0") : "",
    "--sf-button-glow-enabled":
      typeof buttons.glow === "boolean" ? (buttons.glow ? "1" : "0") : "",
    "--sf-button-compact":
      typeof buttons.compact === "boolean" ? (buttons.compact ? "1" : "0") : "",
    "--sf-motion-level": typeof buttons.animationLevel === "string" ? String(buttons.animationLevel) : "",
    "--sf-cart-item-style": typeof cart.itemStyle === "string" ? String(cart.itemStyle) : "",
    "--sf-cart-empty-style": typeof cart.emptyStyle === "string" ? String(cart.emptyStyle) : "",
    "--sf-cart-footer-style": typeof cart.footerStyle === "string" ? String(cart.footerStyle) : "",
    "--sf-cart-qty-style": typeof cart.qtyStyle === "string" ? String(cart.qtyStyle) : "",
    "--sf-drawer-bg": typeof drawer.background === "string" ? String(drawer.background) : "",
    "--sf-drawer-blur": typeof drawer.blur === "boolean" ? (drawer.blur ? "1" : "0") : "",
    "--sf-drawer-active-style": typeof drawer.activeStyle === "string" ? String(drawer.activeStyle) : "",
    "--sf-drawer-avatar-shape": typeof drawer.avatarShape === "string" ? String(drawer.avatarShape) : "",
    "--sf-drawer-density": typeof drawer.density === "string" ? String(drawer.density) : "",
    "--sf-hero-height": typeof hero.height === "number" ? `${hero.height}px` : "",
    "--sf-hero-radius": typeof hero.radius === "number" ? `${hero.radius}px` : "",
    "--sf-hero-layout": typeof hero.layout === "string" ? String(hero.layout) : "",
    "--sf-hero-overlay":
      typeof hero.overlay === "boolean" ? (hero.overlay ? "1" : "0") : "",
    "--sf-hero-overlay-strength":
      typeof hero.overlayStrength === "number" ? String(hero.overlayStrength) : "",
    "--sf-hero-alignment":
      typeof hero.alignment === "string" ? String(hero.alignment) : "",
    "--sf-hero-cta-position":
      typeof hero.ctaPosition === "string" ? String(hero.ctaPosition) : "",
    "--sf-hero-shadow":
      typeof hero.shadow === "boolean" ? (hero.shadow ? "1" : "0") : "",
  };

  const commitPage = useCallback(
    (next: AppNavPage) => {
      if (next === "faq") {
        navigate({
          pathname: "/faq",
          search:
            tenantMergedSearch && tenantMergedSearch !== "?"
              ? tenantMergedSearch
              : "",
        });
        setPage("faq");
        return;
      }
      setPage(next);
      if (location.pathname === "/faq") {
        navigate(
          {
            pathname: "/",
            search:
              tenantMergedSearch && tenantMergedSearch !== "?"
                ? tenantMergedSearch
                : "",
          },
          { replace: true }
        );
      }
    },
    [navigate, location.pathname, tenantMergedSearch]
  );

  useEffect(() => {
    if (location.pathname === "/faq") {
      setPage("faq");
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
    if (v === "merchant-settings") {
      setPage("admin");
      window.location.hash = "#/admin/settings";
      if (location.pathname === "/faq") {
        navigate(
          {
            pathname: "/",
            search:
              tenantMergedSearch && tenantMergedSearch !== "?"
                ? tenantMergedSearch
                : "",
          },
          { replace: true }
        );
      }
    }
  }, [
    location.search,
    commitPage,
    location.pathname,
    navigate,
    tenantMergedSearch,
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
  
  // Storefront header (customer-facing) toggles SideMenu via safe event (no prop drilling).
  useEffect(() => {
    const onToggle = () => handleMenuToggle();
    window.addEventListener("sf:toggleMenu", onToggle as unknown as EventListener);
    return () =>
      window.removeEventListener("sf:toggleMenu", onToggle as unknown as EventListener);
  }, []);

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

  const handleCheckoutQuick = () => {
    if (page !== "checkout") {
      commitPage("checkout");
    }
    setIsMenuOpen(false);
  };

  const goAdminSection = (
    section: "orders" | "products" | "categories" | "analytics" | "settings"
  ) => {
    setPage("admin");
    if (location.pathname === "/faq") {
      navigate(
        {
          pathname: "/",
          search:
            tenantMergedSearch && tenantMergedSearch !== "?"
              ? tenantMergedSearch
              : "",
        },
        { replace: true }
      );
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

  const showHeaderAttentionDot =
    myOrdersAttention && page !== "my-orders" && businessId != null;

  if (shopMissing) {
    return (
      <div className="app app--shop-missing">
        <div className="shop-missing" role="alert">
          <p className="shop-missing__title">Магазин не найден</p>
          <p className="shop-missing__hint">
            Откройте витрину по ссылке с параметром{" "}
            <code className="shop-missing__code">?shop=ID</code> или{" "}
            <code className="shop-missing__code">?businessId=ID</code>, либо
            через кнопку «Открыть» в Telegram (Mini App).
          </p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="app">
      {page !== "home" ? (
        <Header
          menuOpen={isMenuOpen}
          onMenuToggle={handleMenuToggle}
          attentionDot={showHeaderAttentionDot}
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
        onNavToFaq={() => handleNav("faq")}
        onNavToAdmin={goAdminSection}
      />

      <div className={`content app__content${page === "home" ? " app__content--storefront" : ""}`}>
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
        visible={page !== "checkout" && !(page === "home" && totalQuantity > 0)}
        totalQuantity={totalQuantity}
        onOpen={handleFloatingCartClick}
      />

      <StickyCartBar
        visible={page === "home"}
        onOpenCart={handleFloatingCartClick}
        onCheckout={handleCheckoutQuick}
      />
    </div>
  );
  if (!isStorefrontUi) return content;
  return (
    <ThemeVarsProvider theme={theme}>
      <div
        data-sf-kit={sfKit}
        className="sf-root sf-app"
        style={sfVars as unknown as React.CSSProperties}
      >
        {content}
      </div>
    </ThemeVarsProvider>
  );
}
