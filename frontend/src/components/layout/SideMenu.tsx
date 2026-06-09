import { useMemo, useSyncExternalStore } from "react";
import { useBodyScrollLock } from "../../utils/bodyScrollLock";
import { AnimatePresence, motion } from "framer-motion";
import { useAdminPanelVisible } from "@/utils/admin";
import { useAdminGateStore } from "../../store/adminGate.store";
import {
  MERCHANT_PERM,
  hasMerchantPermission,
} from "../../permissions/merchantPermissions";
import { getTelegramUser } from "../../utils/telegram";
import {
  telegramDisplayInitial,
  telegramDisplayName,
} from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
import { useTheme } from "../../context/ThemeContext";
import { ru } from "../../i18n/ru";
import "./app-shell.css";
import { useStorefrontPayload } from "../storefront/runtime/StorefrontPayloadContext";
import { businessTypeSupportsTableReservations } from "@repo-shared/tableReservation";
import { isStorefrontCommerceEnabled } from "../../hooks/useStorefrontCommerceMode";
import { OpenInTelegramCta } from "../storefront/commerce/OpenInTelegramCta";

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

type AdminSection =
  | "orders"
  | "products"
  | "categories"
  | "analytics"
  | "design"
  | "promos"
  | "support";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  currentPage: AppNavPage;
  onNavToHome: () => void;
  onNavToCart: () => void;
  /** Количество позиций в корзине (для бейджа в меню). */
  cartCount?: number;
  /** Красная точка у «Мои заказы», если есть заказы, требующие внимания. */
  myOrdersAttentionDot?: boolean;
  onNavToMyOrders: () => void;
  onNavToFavorites: () => void;
  onNavToAbout: () => void;
  /** Центр поддержки (чат по заказу), не FAQ. */
  onNavToSupport: () => void;
  onNavToFaq: () => void;
  onOpenStoreProfile: (section?: "delivery" | "schedule") => void;
  onNavToTableBooking: () => void;
  onNavToAdmin: (section: AdminSection) => void;
};

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function readHash(): string {
  return window.location.hash;
}

function activeAdminSection(hash: string): AdminSection | null {
  if (!hash.includes("/admin")) return null;
  if (hash.includes("/admin/design")) return "design";
  if (hash.includes("/admin/promos")) return "promos";
  if (hash.includes("/admin/support")) return "support";
  if (hash.includes("/analytics")) return "analytics";
  if (hash.includes("/categories")) return "categories";
  if (hash.includes("/products")) return "products";
  if (hash.includes("/orders")) return "orders";
  return "orders";
}

const ADMIN_LINKS: {
  section: AdminSection;
  hash: string;
  icon: string;
  label: string;
  permission?: string;
}[] = [
  { section: "orders", hash: "#/admin/orders", icon: "🗂️", label: "Заказы", permission: MERCHANT_PERM.ordersManage },
  {
    section: "support",
    hash: "#/admin/support",
    icon: "💬",
    label: "Поддержка",
    permission: MERCHANT_PERM.supportManage,
  },
  { section: "design", hash: "#/admin/design", icon: "🎨", label: "Оформление", permission: MERCHANT_PERM.designEdit },
  { section: "products", hash: "#/admin/products", icon: "🏷️", label: "Товары", permission: MERCHANT_PERM.catalogEdit },
  { section: "categories", hash: "#/admin/categories", icon: "🗂", label: "Категории", permission: MERCHANT_PERM.catalogEdit },
  { section: "promos", hash: "#/admin/promos", icon: "🎟️", label: "Промокоды", permission: MERCHANT_PERM.settingsManage },
  { section: "analytics", hash: "#/admin/analytics", icon: "📊", label: "Аналитика", permission: MERCHANT_PERM.analyticsView },
];

export default function SideMenu({
  open,
  onClose,
  currentPage,
  onNavToHome,
  myOrdersAttentionDot = false,
  onNavToMyOrders,
  onNavToFavorites,
  onNavToSupport,
  onOpenStoreProfile,
  onNavToTableBooking,
  onNavToAdmin,
}: SideMenuProps) {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();
  const showTableBooking =
    commerceEnabled &&
    businessTypeSupportsTableReservations(payload?.businessType);
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const user = useMemo(() => getTelegramUser(), []);
  const admin = useAdminPanelVisible();
  const merchantPermissions = useAdminGateStore((s) => s.merchantPermissions);
  const merchantRole = useAdminGateStore((s) => s.merchantRole);
  const adminLinks = useMemo(
    () =>
      ADMIN_LINKS.filter((link) =>
        hasMerchantPermission(
          merchantPermissions,
          link.permission as typeof MERCHANT_PERM.ordersManage | undefined,
          merchantRole,
        ),
      ),
    [merchantPermissions, merchantRole],
  );
  const adminActive = activeAdminSection(hash);
  const { theme } = useTheme();
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const storeName = payload?.storeName?.trim() || APP_NAME;
  const logoUrl =
    typeof theme.logoUrl === "string" && theme.logoUrl.trim() !== ""
      ? theme.logoUrl.trim()
      : "";
  const brandTagline = readTxt("brandTagline", readTxt("drawerTagline", ""));

  useBodyScrollLock(open);

  const homeActive = currentPage === "home";
  const myOrdersActive = currentPage === "my-orders";
  const favoritesActive = currentPage === "favorites";
  const supportActive = currentPage === "support";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="app-overlay"
            className="app-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
          />
          <motion.aside
            key="app-drawer"
            className="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="app-drawer__pull" aria-hidden />
            <div className="app-drawer__scroll">
              <div className="app-drawer__brand">
                <button
                  type="button"
                  className="app-drawer__brand-btn"
                  onClick={() => {
                    onNavToHome();
                    onClose();
                  }}
                >
                  <div className="app-drawer__brand-row">
                    {logoUrl !== "" ? (
                      <img
                        src={logoUrl}
                        alt=""
                        className="app-drawer__brand-logo"
                        width={48}
                        height={48}
                      />
                    ) : (
                      <div className="app-drawer__brand-logo app-drawer__brand-logo--ph" aria-hidden>
                        {storeName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="app-drawer__brand-text">
                      <div className="app-drawer__brand-title">{storeName}</div>
                      {brandTagline !== "" ? (
                        <div className="app-drawer__brand-tag">{brandTagline}</div>
                      ) : null}
                    </div>
                  </div>
                </button>
              </div>

              <nav className="app-drawer__nav" aria-label="Разделы">
                <button
                  type="button"
                  className={`app-drawer__link${homeActive ? " app-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToHome();
                    onClose();
                  }}
                >
                  <span className="app-drawer__link-icon" aria-hidden>
                    🛍
                  </span>
                  {readTxt("menuShopLabel", ru.menu.shop)}
                </button>

                {commerceEnabled ? (
                  <button
                    type="button"
                    className={`app-drawer__link app-drawer__link--orders${myOrdersActive ? " app-drawer__link--active" : ""}`}
                    onClick={() => {
                      onNavToMyOrders();
                      onClose();
                    }}
                  >
                    {myOrdersAttentionDot && !myOrdersActive ? (
                      <span className="app-drawer__orders-attention-dot" aria-hidden />
                    ) : null}
                    <span className="app-drawer__link-icon" aria-hidden>
                      📦
                    </span>
                    {readTxt("menuOrdersLabel", ru.menu.orders)}
                  </button>
                ) : null}

                {commerceEnabled ? (
                  <button
                    type="button"
                    className={`app-drawer__link${favoritesActive ? " app-drawer__link--active" : ""}`}
                    onClick={() => {
                      onNavToFavorites();
                      onClose();
                    }}
                  >
                    <span className="app-drawer__link-icon" aria-hidden>
                      ❤️
                    </span>
                    Избранное
                  </button>
                ) : null}

                {commerceEnabled ? (
                  <button
                    type="button"
                    className={`app-drawer__link${supportActive ? " app-drawer__link--active" : ""}`}
                    onClick={() => {
                      onNavToSupport();
                      onClose();
                    }}
                  >
                    <span className="app-drawer__link-icon" aria-hidden>
                      💬
                    </span>
                    {readTxt("menuSupportLabel", ru.menu.support)}
                  </button>
                ) : null}

                {commerceEnabled ? (
                  <button
                    type="button"
                    className="app-drawer__link"
                    onClick={() => {
                      onOpenStoreProfile();
                      onClose();
                    }}
                  >
                    <span className="app-drawer__link-icon" aria-hidden>
                      🏪
                    </span>
                    {readTxt("menuStoreProfileLabel", "Профиль магазина")}
                  </button>
                ) : null}

                {showTableBooking ? (
                  <button
                    type="button"
                    className={`app-drawer__link${currentPage === "table-booking" ? " app-drawer__link--active" : ""}`}
                    onClick={() => {
                      onNavToTableBooking();
                      onClose();
                    }}
                  >
                    <span className="app-drawer__link-icon" aria-hidden>
                      🍽
                    </span>
                    Забронировать столик
                  </button>
                ) : null}

                {!commerceEnabled ? (
                  <div className="app-drawer__web-cta">
                    <OpenInTelegramCta
                      telegramOpenUrl={payload?.telegramOpenUrl ?? null}
                      variant="hero"
                    />
                  </div>
                ) : null}

                {admin && (
                  <>
                    <div className="app-drawer__divider" aria-hidden />
                    {adminLinks.map(({ section, icon, label }) => {
                      const isActive =
                        currentPage === "admin" && adminActive === section;
                      return (
                        <button
                          key={section}
                          type="button"
                          className={`app-drawer__link${isActive ? " app-drawer__link--active" : ""}`}
                          onClick={() => {
                            onNavToAdmin(section);
                            onClose();
                          }}
                        >
                          <span className="app-drawer__link-icon" aria-hidden>
                            {icon}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </>
                )}
              </nav>
            </div>

            <div className="app-drawer__footer">
              <div className="app-drawer__user">
                <div className="app-drawer__user-avatar" aria-hidden>
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt="" width={44} height={44} />
                  ) : (
                    telegramDisplayInitial(user)
                  )}
                </div>
                <div className="app-drawer__user-meta">
                  <div className="app-drawer__user-name">
                    {telegramDisplayName(user)}
                  </div>
                  {user?.username ? (
                    <div className="app-drawer__user-handle">@{user.username}</div>
                  ) : (
                    <div className="app-drawer__user-handle">Telegram</div>
                  )}
                </div>
              </div>
              <button type="button" className="app-drawer__close-btn" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
