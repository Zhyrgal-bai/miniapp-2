import type { WebProfileView } from "../../../utils/webProfileUx";
import { showcaseAccentVars } from "../../../utils/webProfileUx";
import "./webShowcase.css";

type Props = {
  storeName?: string;
  city?: string | null;
  profile: WebProfileView | null;
};

/** Public business-website hero: cover + logo-less name + slogan (web mode only). */
export function WebShowcaseHeader({ storeName, city, profile }: Props): React.ReactElement | null {
  const cover = profile?.coverUrl ?? null;
  const slogan = profile?.slogan ?? null;
  if (storeName == null && cover == null && slogan == null) return null;

  return (
    <header
      className="sf-showcase-header"
      style={showcaseAccentVars(profile) as React.CSSProperties}
    >
      {cover != null ? (
        <div className="sf-showcase-header__cover">
          <img src={cover} alt="" loading="eager" decoding="async" />
          <div className="sf-showcase-header__cover-veil" aria-hidden />
        </div>
      ) : (
        <div className="sf-showcase-header__cover sf-showcase-header__cover--placeholder" aria-hidden />
      )}
      <div className="sf-showcase-header__body">
        {storeName ? <h1 className="sf-showcase-header__name">{storeName}</h1> : null}
        {city ? <p className="sf-showcase-header__city">{city}</p> : null}
        {slogan ? <p className="sf-showcase-header__slogan">{slogan}</p> : null}
      </div>
    </header>
  );
}
