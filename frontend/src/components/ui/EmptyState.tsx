import "./emptyState.css";

export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
};

export function EmptyState(props: EmptyStateProps): React.ReactElement {
  const {
    icon = "📦",
    title,
    description,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
    compact = false,
  } = props;

  return (
    <div
      className={`sf-empty-state${compact ? " sf-empty-state--compact" : ""}`}
      role="status"
    >
      <div className="sf-empty-state__icon" aria-hidden>
        {icon}
      </div>
      <h3 className="sf-empty-state__title">{title}</h3>
      {description ? <p className="sf-empty-state__desc">{description}</p> : null}
      {actionLabel && onAction ? (
        <div className="sf-empty-state__actions">
          <button type="button" className="sf-empty-state__btn sf-empty-state__btn--primary" onClick={onAction}>
            {actionLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button type="button" className="sf-empty-state__btn sf-empty-state__btn--ghost" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
