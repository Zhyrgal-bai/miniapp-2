import "./errorState.css";

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
};

export function ErrorState(props: ErrorStateProps): React.ReactElement {
  const {
    title = "Что-то пошло не так",
    message,
    onRetry,
    onBack,
    retryLabel = "Повторить",
    backLabel = "Назад",
  } = props;

  return (
    <div className="sf-error-state" role="alert">
      <div className="sf-error-state__icon" aria-hidden>
        ⚠️
      </div>
      <h2 className="sf-error-state__title">{title}</h2>
      <p className="sf-error-state__message">{message}</p>
      {(onRetry || onBack) && (
        <div className="sf-error-state__actions">
          {onRetry ? (
            <button type="button" className="sf-error-state__btn sf-error-state__btn--primary" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {onBack ? (
            <button type="button" className="sf-error-state__btn sf-error-state__btn--ghost" onClick={onBack}>
              {backLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
