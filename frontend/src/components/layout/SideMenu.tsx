import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdminPanelVisible } from "@/utils/admin";
import { getTelegramUser } from "../../utils/telegram";
import {
  telegramDisplayInitial,
  telegramDisplayName,
} from "../../utils/telegramUserMark";
import { APP_NAME } from "../../config/brand";
import "./app-shell.css";

const SUPPORT_BOT_URL = "https://t.me/coffee_market_test_bot";

type AppNavPage =
  | "home"
  | "cart"
  | "checkout"
  | "admin"
  | "faq"
  | "my-orders"
  | "connect-bot";

type AdminSection =
  | "orders"
  | "products"
  | "categories"
  | "analytics"
  | "settings";

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
  onNavToFaq: () => void;
  onNavToConnectBot: () => void;
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
  if (hash.includes("/analytics")) return "analytics";
  if (hash.includes("/settings")) return "settings";
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
}[] = [
  { section: "orders", hash: "#/admin/orders", icon: "🗂️", label: "Заказы" },
  { section: "products", hash: "#/admin/products", icon: "🏷️", label: "Товары" },
  { section: "categories", hash: "#/admin/categories", icon: "🗂", label: "Категории" },
  { section: "analytics", hash: "#/admin/analytics", icon: "📊", label: "Аналитика" },
  { section: "settings", hash: "#/admin/settings", icon: "⚙", label: "Настройки" },
];

export default function SideMenu({
  open,
  onClose,
  currentPage,
  onNavToHome,
  onNavToCart,
  cartCount = 0,
  myOrdersAttentionDot = false,
  onNavToMyOrders,
  onNavToFaq,
  onNavToConnectBot,
  onNavToAdmin,
}: SideMenuProps) {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const user = useMemo(() => getTelegramUser(), []);
  const admin = useAdminPanelVisible();
  const adminActive = activeAdminSection(hash);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const homeActive = currentPage === "home";
  const cartActive = currentPage === "cart";
  const myOrdersActive = currentPage === "my-orders";
  const faqActive = currentPage === "faq";
  const connectBotActive = currentPage === "connect-bot";

  const openSupport = () => {
    window.open(SUPPORT_BOT_URL, "_blank", "noopener,noreferrer");
    onClose();
  };

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
            drag="x"
            dragConstraints={{ left: -130, right: 0 }}
            dragElastic={0.06}
            onDragEnd={(_, info) => {
              if (info.offset.x < -48 || info.velocity.x < -400) {
                onClose();
              }
            }}
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
                  <div className="app-drawer__brand-title">{APP_NAME}</div>
                  <div className="app-drawer__brand-tag">одежда</div>
                </button>
              </div>

              <nav className="app-drawer__nav" aria-label="Разделы">
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
                  Мои заказы
                </button>

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
                  Магазин
                </button>

                <button
                  type="button"
                  className={`app-drawer__link${cartActive ? " app-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToCart();
                    onClose();
                  }}
                >
                  <span className="app-drawer__link-icon app-drawer__link-icon--with-badge" aria-hidden>
                    🛒
                    {cartCount > 0 && (
                      <span className="app-drawer__cart-badge">{cartCount}</span>
                    )}
                  </span>
                  Корзина
                </button>

                {admin && (
                  <>
                    <div className="app-drawer__divider" aria-hidden />
                    {ADMIN_LINKS.map(({ section, icon, label }) => {
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

                <div className="app-drawer__divider" aria-hidden />

                <button
                  type="button"
                  className={`app-drawer__link${connectBotActive ? " app-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToConnectBot();
                    onClose();
                  }}
                >
                  <span className="app-drawer__link-icon" aria-hidden>
                    🤖
                  </span>
                  Подключить бота
                </button>

                <button
                  type="button"
                  className={`app-drawer__link${faqActive ? " app-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToFaq();
                    onClose();
                  }}
                >
                  <span className="app-drawer__link-icon" aria-hidden>
                    ❓
                  </span>
                  FAQ
                </button>

                <button type="button" className="app-drawer__link" onClick={openSupport}>
                  <span className="app-drawer__link-icon" aria-hidden>
                    💬
                  </span>
                  Поддержка
                </button>
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
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
