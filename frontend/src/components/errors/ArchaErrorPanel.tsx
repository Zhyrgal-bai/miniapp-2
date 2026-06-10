import { ARCHA_ERROR_COPY, type ErrorKind } from "./errorCopy";
import "./archaError.css";

type Props = {
  kind?: ErrorKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

/** In-page ARCHA error panel (storefront / merchant contexts). */
export default function ArchaErrorPanel({
  kind = "load_failed",
  title,
  message,
  onRetry,
  onBack,
}: Props): React.ReactElement {
  const copy = ARCHA_ERROR_COPY[kind];
  return (
    <div className="archa-error-panel" role="alert">
      <p className="archa-error-panel__title">{title ?? copy.title}</p>
      <p className="archa-error-panel__hint">{message ?? copy.hint}</p>
      <div className="archa-error-panel__actions">
        {onRetry ? (
          <button type="button" className="archa-btn-primary" onClick={onRetry}>
            Повторить
          </button>
        ) : null}
        {onBack ? (
          <button type="button" className="archa-btn-ghost" onClick={onBack}>
            Назад
          </button>
        ) : null}
      </div>
    </div>
  );
}
