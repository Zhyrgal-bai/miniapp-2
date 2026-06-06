import { useEffect, useState } from "react";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import type { PublicStoreAvailability } from "@repo-shared/storeAvailabilitySettings";
import { loadCustomerLocation } from "../../storefront/customerLocationStorage";
import "./StorefrontCompactStrip.css";

const STATUS_DOT: Record<PublicStoreAvailability["status"], string> = {
  OPEN: "sf-compact-strip__dot--open",
  CLOSING_SOON: "sf-compact-strip__dot--closing",
  OPENING_SOON: "sf-compact-strip__dot--closing",
  CLOSED: "sf-compact-strip__dot--closed",
};

type Props = {
  businessId: number;
  storeName?: string;
  storeCity?: string;
  availability: PublicStoreAvailability | null | undefined;
  onOpenProfile?: () => void;
};

export function StorefrontCompactStrip({
  businessId,
  storeName,
  storeCity,
  availability,
  onOpenProfile,
}: Props): React.ReactElement | null {
  const [customerCity, setCustomerCity] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const loc = loadCustomerLocation(businessId);
      setCustomerCity(loc.city);
    };
    sync();
    window.addEventListener("sf:customerLocationChanged", sync);
    return () => window.removeEventListener("sf:customerLocationChanged", sync);
  }, [businessId]);

  const locationLabel = customerCity ?? storeCity ?? null;
  const deliveryEta =
    availability?.deliveryEnabled && availability.deliveryEta
      ? formatEtaRange(availability.deliveryEta)
      : null;

  const title = String(storeName ?? "").trim();
  if (title === "" && availability == null && locationLabel == null) return null;

  const statusClass =
    availability != null ? STATUS_DOT[availability.status] : "sf-compact-strip__dot--open";

  return (
    <button
      type="button"
      className="sf-compact-strip sf-section sf-section--padded"
      aria-label="Информация о магазине"
      onClick={onOpenProfile}
      disabled={onOpenProfile == null}
    >
      <div className="sf-compact-strip__shell archa-glass">
        {title !== "" ? (
          <div className="sf-compact-strip__name">{title}</div>
        ) : null}
        <div className="sf-compact-strip__rows">
          {availability ? (
            <div className="sf-compact-strip__row">
              <span className={`sf-compact-strip__dot ${statusClass}`} aria-hidden />
              <span className="sf-compact-strip__text">{availability.label}</span>
              {availability.detail ? (
                <span className="sf-compact-strip__meta">{availability.detail}</span>
              ) : null}
            </div>
          ) : null}
          {locationLabel ? (
            <div className="sf-compact-strip__row">
              <span className="sf-compact-strip__icon" aria-hidden>
                📍
              </span>
              <span className="sf-compact-strip__text">{locationLabel}</span>
            </div>
          ) : null}
          {deliveryEta ? (
            <div className="sf-compact-strip__row">
              <span className="sf-compact-strip__icon" aria-hidden>
                🚚
              </span>
              <span className="sf-compact-strip__text">{deliveryEta}</span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
