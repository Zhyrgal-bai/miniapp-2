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
      <span className="sf-showcase-footer__brand">Powered by ARCHA</span>
      {telegramOpenUrl ? (
        <a
          className="sf-showcase-footer__tg"
          href={telegramOpenUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть в Telegram
        </a>
      ) : null}
    </footer>
  );
}
