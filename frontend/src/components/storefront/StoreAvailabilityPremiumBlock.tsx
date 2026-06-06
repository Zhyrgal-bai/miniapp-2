import type { PublicStoreAvailability } from "@repo-shared/storeAvailabilitySettings";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import "./StoreAvailabilityPremiumBlock.css";

const STATUS_CLASS: Record<
  PublicStoreAvailability["status"],
  string
> = {
  OPEN: "sf-avail--open",
  CLOSING_SOON: "sf-avail--closing",
  OPENING_SOON: "sf-avail--closing",
  CLOSED: "sf-avail--closed",
};

type Props = {
  availability: PublicStoreAvailability;
};

export function StoreAvailabilityPremiumBlock({
  availability: a,
}: Props): React.ReactElement {
  const deliveryEta = formatEtaRange(a.deliveryEta);
  const pickupEta = formatEtaRange(a.pickupEta);

  return (
    <section
      className={`sf-avail sf-section sf-section--padded ${STATUS_CLASS[a.status]}`}
      aria-label="График и доставка"
    >
      <div className="sf-avail__shell archa-glass archa-glass--glow">
        <div className="sf-avail__status-row">
          <span className="sf-avail__status-label">{a.label}</span>
          <span className="sf-avail__status-detail">{a.detail}</span>
        </div>

        <div className="sf-avail__grid">
          {a.deliveryEnabled ? (
            <div className="sf-avail__tile">
              <span className="sf-avail__tile-icon" aria-hidden>
                🚚
              </span>
              <div>
                <div className="sf-avail__tile-title">Доставка</div>
                <div className="sf-avail__tile-value">{deliveryEta}</div>
              </div>
            </div>
          ) : null}

          {a.pickupEnabled ? (
            <div className="sf-avail__tile">
              <span className="sf-avail__tile-icon" aria-hidden>
                🏪
              </span>
              <div>
                <div className="sf-avail__tile-title">Самовывоз</div>
                <div className="sf-avail__tile-value">{pickupEta}</div>
              </div>
            </div>
          ) : null}
        </div>

        {a.deliveryZones.length > 0 && a.deliveryEnabled ? (
          <div className="sf-avail__zones">
            <div className="sf-avail__zones-title">Зоны доставки</div>
            <ul className="sf-avail__zones-list">
              {a.deliveryZones.map((z) => (
                <li key={z.id} className="sf-avail__zone-row">
                  <span>{z.title}</span>
                  <span className="sf-avail__zone-meta">
                    {z.distanceLabel} · {z.etaLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
