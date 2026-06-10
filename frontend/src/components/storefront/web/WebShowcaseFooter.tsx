import { ARCHA_BRAND } from "../../../config/brandAssets";
import "./webShowcase.css";

type Props = {
  telegramOpenUrl?: string | null;
};

/**
 * Small "Powered by ARCHA" footer for merchant showcase pages (web mode only).
 * Intentionally contains NO founder information — that lives only on the ARCHA landing.
 */
export function WebShowcaseFooter({ telegramOpenUrl }: Props): React.ReactElement {
  return (
    <footer className="sf-showcase-footer">
      <div className="sf-showcase-footer__brand-wrap">
        <img
          className="sf-showcase-footer__icon"
          src={ARCHA_BRAND.logoIcon}
          alt=""
          width={22}
          height={22}
          aria-hidden
        />
        <span className="sf-showcase-footer__brand">Powered by ARCHA</span>
      </div>
      {telegramOpenUrl ? (
        <a
          className="sf-showcase-footer__tg"
          href={telegramOpenUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Telegram →
        </a>
      ) : null}
    </footer>
  );
}
