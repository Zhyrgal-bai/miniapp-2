import { buildCloudinaryResponsiveUrl } from "../../utils/cloudinaryTransforms";
import { storeBrandInitials } from "../layout/storeBrandHeaderUtils";
import { resolveStoreOpenStatus } from "../../utils/storeOpenStatus";
import "./storefrontStoreCard.css";

function readText(cfg: Record<string, unknown> | undefined, key: string): string {
  const v = cfg?.[key];
  return typeof v === "string" ? v.trim() : "";
}

export function StorefrontStoreCard(props: {
  storeName?: string;
  storeAddress?: {
    addressLine: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  logoUrl?: string | null;
  textConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  const storeName = String(props.storeName ?? "").trim();
  const city = String(props.storeAddress?.city ?? "").trim();
  const addressLine = String(props.storeAddress?.addressLine ?? "").trim();
  const logoSrc =
    props.logoUrl != null && props.logoUrl.trim() !== ""
      ? buildCloudinaryResponsiveUrl(props.logoUrl.trim(), "thumbnail")
      : "";
  const initials = storeBrandInitials(storeName || "Магазин");
  const status = resolveStoreOpenStatus(props.textConfig);
  const tagline = readText(props.textConfig, "brandTagline");

  if (storeName === "" && city === "" && logoSrc === "") return null;

  return (
    <section className="sf-section sf-section--store-card sf-section--padded" aria-label="О магазине">
      <div className="sf-store-card">
        <div className="sf-store-card__brand">
          {logoSrc ? (
            <img className="sf-store-card__logo" src={logoSrc} alt="" decoding="async" />
          ) : (
            <div className="sf-store-card__logo sf-store-card__logo--fallback" aria-hidden>
              {initials}
            </div>
          )}
          <div className="sf-store-card__meta">
            {storeName !== "" ? <h1 className="sf-store-card__name">{storeName}</h1> : null}
            {city !== "" ? (
              <p className="sf-store-card__city">
                <span className="sf-store-card__city-icon" aria-hidden>
                  📍
                </span>
                {city}
              </p>
            ) : addressLine !== "" ? (
              <p className="sf-store-card__city">{addressLine}</p>
            ) : null}
            {tagline !== "" ? <p className="sf-store-card__tagline">{tagline}</p> : null}
          </div>
        </div>
        <div
          className={`sf-store-card__status${status.isOpen ? " sf-store-card__status--open" : " sf-store-card__status--closed"}`}
          role="status"
        >
          <span className="sf-store-card__status-label">{status.label}</span>
          {status.detail ? (
            <span className="sf-store-card__status-detail">{status.detail}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
