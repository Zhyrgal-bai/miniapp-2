import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import type { PublicStoreAvailability } from "@repo-shared/storeAvailabilitySettings";
import { buildCloudinaryResponsiveUrl } from "../../utils/cloudinaryTransforms";
import { storeBrandInitials } from "../layout/storeBrandHeaderUtils";
import { useBodyScrollLock } from "../../utils/bodyScrollLock";
import { getTelegramWebApp } from "../../utils/telegram";
import "./StoreProfileSheet.css";

export type StoreProfileContact = {
  phone: string | null;
  instagramUrl: string | null;
  footerText: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  storeName?: string;
  logoUrl?: string | null;
  storeAddress?: {
    addressLine: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  availability?: PublicStoreAvailability | null;
  textConfig?: Record<string, unknown>;
  contacts?: StoreProfileContact;
  onOpenSupport?: () => void;
  onOpenAbout?: () => void;
  onOpenFaq?: () => void;
  initialSection?: "delivery" | "schedule" | null;
};

function readText(cfg: Record<string, unknown> | undefined, key: string): string {
  const v = cfg?.[key];
  return typeof v === "string" ? v.trim() : "";
}

const STATUS_CLASS: Record<
  NonNullable<PublicStoreAvailability>["status"],
  string
> = {
  OPEN: "sf-profile-sheet__status--open",
  CLOSING_SOON: "sf-profile-sheet__status--closing",
  OPENING_SOON: "sf-profile-sheet__status--closing",
  CLOSED: "sf-profile-sheet__status--closed",
};

export function StoreProfileSheet({
  open,
  onClose,
  storeName,
  logoUrl,
  storeAddress,
  availability,
  textConfig,
  contacts,
  onOpenSupport,
  onOpenAbout,
  onOpenFaq,
  initialSection,
}: Props): React.ReactElement | null {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || initialSection == null) return;
    const id =
      initialSection === "delivery"
        ? "sf-profile-delivery"
        : initialSection === "schedule"
          ? "sf-profile-schedule"
          : null;
    if (id == null) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [open, initialSection]);

  const portalRoot =
    typeof document !== "undefined"
      ? (document.getElementById("sf-theme-portal-root") ?? document.body)
      : null;

  const logoSrc =
    logoUrl != null && logoUrl.trim() !== ""
      ? buildCloudinaryResponsiveUrl(logoUrl.trim(), "thumbnail")
      : "";
  const name = String(storeName ?? "").trim() || "Магазин";
  const initials = storeBrandInitials(name);
  const tagline = readText(textConfig, "brandTagline");
  const aboutLead =
    readText(textConfig, "aboutShopLead") ||
    "Мы рады видеть вас в нашем магазине. Здесь вы найдёте актуальный каталог и удобное оформление заказа.";
  const addressDisplay = useMemo(() => {
    const city = String(storeAddress?.city ?? "").trim();
    const line = String(storeAddress?.addressLine ?? "").trim();
    if (city !== "" && line !== "") return `${city}, ${line}`;
    return city || line;
  }, [storeAddress]);

  const mapUrl = useMemo(() => {
    if (storeAddress?.latitude == null || storeAddress?.longitude == null) return null;
    const lat = storeAddress.latitude;
    const lng = storeAddress.longitude;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  }, [storeAddress]);

  const openTelegramSettings = () => {
    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink("https://t.me/settings");
      return;
    }
    window.open("https://t.me/settings", "_blank", "noopener,noreferrer");
  };

  if (portalRoot == null) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="profile-backdrop"
            className="sf-profile-sheet__backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            key="profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Профиль магазина"
            className="sf-profile-sheet"
            initial={{ y: "104%" }}
            animate={{ y: 0 }}
            exit={{ y: "104%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.42 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 96 || info.velocity.y > 520) onClose();
            }}
          >
            <div className="sf-profile-sheet__handle" aria-hidden />
            <div className="sf-profile-sheet__scroll">
              <header className="sf-profile-sheet__hero archa-glass archa-glass--glow">
                <div className="sf-profile-sheet__brand">
                  {logoSrc ? (
                    <img
                      className="sf-profile-sheet__logo"
                      src={logoSrc}
                      alt=""
                      width={64}
                      height={64}
                    />
                  ) : (
                    <div className="sf-profile-sheet__logo sf-profile-sheet__logo--fallback" aria-hidden>
                      {initials}
                    </div>
                  )}
                  <div className="sf-profile-sheet__meta">
                    <h2 className="sf-profile-sheet__name">{name}</h2>
                    {tagline !== "" ? (
                      <p className="sf-profile-sheet__tagline">{tagline}</p>
                    ) : null}
                    {addressDisplay !== "" ? (
                      <p className="sf-profile-sheet__address">{addressDisplay}</p>
                    ) : null}
                  </div>
                </div>
                {availability ? (
                  <div
                    className={`sf-profile-sheet__status ${STATUS_CLASS[availability.status]}`}
                    role="status"
                  >
                    <span>{availability.label}</span>
                    {availability.detail ? (
                      <span className="sf-profile-sheet__status-detail">
                        {availability.detail}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </header>

              <nav className="sf-profile-sheet__nav" aria-label="Разделы магазина">
                {addressDisplay !== "" ? (
                  <section className="sf-profile-sheet__section" id="sf-profile-address">
                    <h3 className="sf-profile-sheet__section-title">📍 Адрес</h3>
                    <p className="sf-profile-sheet__section-body">{addressDisplay}</p>
                    {mapUrl ? (
                      <a
                        className="sf-profile-sheet__link-btn"
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Открыть на карте
                      </a>
                    ) : null}
                  </section>
                ) : null}

                {availability?.deliveryEnabled ? (
                  <section className="sf-profile-sheet__section" id="sf-profile-delivery">
                    <h3 className="sf-profile-sheet__section-title">🚚 Доставка</h3>
                    <p className="sf-profile-sheet__section-body">
                      {formatEtaRange(availability.deliveryEta)}
                    </p>
                    {availability.deliveryZones.length > 0 ? (
                      <ul className="sf-profile-sheet__zones">
                        {availability.deliveryZones.map((z) => (
                          <li key={z.id}>
                            <span>{z.title}</span>
                            <span>
                              {z.distanceLabel} · {z.etaLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null}

                {availability?.pickupEnabled ? (
                  <section className="sf-profile-sheet__section">
                    <h3 className="sf-profile-sheet__section-title">🏪 Самовывоз</h3>
                    <p className="sf-profile-sheet__section-body">
                      Будет готов через {formatEtaRange(availability.pickupEta)}
                    </p>
                  </section>
                ) : null}

                {availability?.weeklySchedule && availability.weeklySchedule.length > 0 ? (
                  <section className="sf-profile-sheet__section" id="sf-profile-schedule">
                    <h3 className="sf-profile-sheet__section-title">⏰ График</h3>
                    <ul className="sf-profile-sheet__schedule">
                      {availability.weeklySchedule.map((row) => (
                        <li
                          key={row.dayKey}
                          className={
                            row.closed ? "sf-profile-sheet__schedule-row--closed" : undefined
                          }
                        >
                          <span>{row.dayLabel}</span>
                          <span>{row.hoursLabel}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {contacts?.phone ? (
                  <section className="sf-profile-sheet__section">
                    <h3 className="sf-profile-sheet__section-title">☎ Контакты</h3>
                    <a className="sf-profile-sheet__link-btn" href={`tel:${contacts.phone}`}>
                      {contacts.phone}
                    </a>
                    {contacts.instagramUrl ? (
                      <a
                        className="sf-profile-sheet__link-btn"
                        href={contacts.instagramUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Instagram
                      </a>
                    ) : null}
                  </section>
                ) : null}

                <section className="sf-profile-sheet__section">
                  <h3 className="sf-profile-sheet__section-title">ℹ О магазине</h3>
                  <p className="sf-profile-sheet__section-body">{aboutLead}</p>
                  {onOpenAbout ? (
                    <button
                      type="button"
                      className="sf-profile-sheet__link-btn sf-profile-sheet__link-btn--ghost"
                      onClick={() => {
                        onClose();
                        onOpenAbout();
                      }}
                    >
                      Подробнее
                    </button>
                  ) : null}
                </section>

                {onOpenSupport ? (
                  <section className="sf-profile-sheet__section">
                    <h3 className="sf-profile-sheet__section-title">💬 Поддержка</h3>
                    <button
                      type="button"
                      className="sf-profile-sheet__cta archa-btn-primary"
                      onClick={() => {
                        onClose();
                        onOpenSupport();
                      }}
                    >
                      Написать в поддержку
                    </button>
                  </section>
                ) : null}

                {onOpenFaq ? (
                  <section className="sf-profile-sheet__section">
                    <h3 className="sf-profile-sheet__section-title">📜 Политика возврата</h3>
                    <button
                      type="button"
                      className="sf-profile-sheet__link-btn sf-profile-sheet__link-btn--ghost"
                      onClick={() => {
                        onClose();
                        onOpenFaq();
                      }}
                    >
                      FAQ и возвраты
                    </button>
                  </section>
                ) : null}
              </nav>
            </div>

            <footer className="sf-profile-sheet__footer">
              <button
                type="button"
                className="sf-profile-sheet__footer-btn"
                onClick={openTelegramSettings}
              >
                Настройки Telegram
              </button>
              <button
                type="button"
                className="sf-profile-sheet__close archa-btn-ghost"
                onClick={onClose}
              >
                Закрыть
              </button>
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
