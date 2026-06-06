import { useEffect, useMemo, useState } from "react";
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

type Segment = {
  key: string;
  icon?: React.ReactNode;
  text: string;
};

export function StorefrontCompactStrip({
  businessId,
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

  const segments = useMemo((): Segment[] => {
    const out: Segment[] = [];
    if (availability?.label) {
      out.push({
        key: "status",
        icon: (
          <span
            className={`sf-compact-strip__dot ${STATUS_DOT[availability.status] ?? "sf-compact-strip__dot--open"}`}
            aria-hidden
          />
        ),
        text: availability.label,
      });
    }
    if (locationLabel) {
      out.push({ key: "loc", icon: "📍", text: locationLabel });
    }
    if (deliveryEta) {
      out.push({ key: "eta", icon: "🚚", text: deliveryEta });
    }
    return out;
  }, [availability, locationLabel, deliveryEta]);

  if (segments.length === 0) return null;

  return (
    <button
      type="button"
      className="sf-compact-strip sf-compact-strip--inline sf-section sf-section--padded"
      aria-label="Статус магазина и доставка"
      onClick={onOpenProfile}
      disabled={onOpenProfile == null}
    >
      <div className="sf-compact-strip__shell">
        <div className="sf-compact-strip__line">
          {segments.map((seg, i) => (
            <span key={seg.key} className="sf-compact-strip__segment-wrap">
              {i > 0 ? <span className="sf-compact-strip__sep" aria-hidden>·</span> : null}
              <span className="sf-compact-strip__segment">
                {seg.icon}
                <span className="sf-compact-strip__segment-text">{seg.text}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
