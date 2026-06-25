type DeliveryEmptyStateProps = {
  variant: "no-deliveries" | "no-results" | "no-analytics" | "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
};

const PRESETS: Record<
  DeliveryEmptyStateProps["variant"],
  { icon: string; title: string; message: string }
> = {
  "no-deliveries": {
    icon: "🚚",
    title: "Доставок пока нет",
    message: "Когда клиенты оформят доставку, заказы появятся здесь.",
  },
  "no-results": {
    icon: "🔍",
    title: "Ничего не найдено",
    message: "Попробуйте изменить фильтры или поисковый запрос.",
  },
  "no-analytics": {
    icon: "📊",
    title: "Недостаточно данных",
    message: "Аналитика появится после первых доставок за выбранный период.",
  },
  error: {
    icon: "⚠️",
    title: "Не удалось загрузить",
    message: "Проверьте соединение и попробуйте снова.",
  },
};

export function DeliveryEmptyState({
  variant,
  title,
  message,
  onRetry,
}: DeliveryEmptyStateProps) {
  const preset = PRESETS[variant];
  return (
    <div className="dlv-empty" role="status">
      <div className="dlv-empty__icon" aria-hidden>
        {preset.icon}
      </div>
      <h3 className="dlv-empty__title">{title ?? preset.title}</h3>
      <p className="dlv-empty__text">{message ?? preset.message}</p>
      {onRetry ? (
        <button
          type="button"
          className="dlv-btn dlv-btn--primary"
          style={{ marginTop: 16 }}
          onClick={onRetry}
        >
          Повторить
        </button>
      ) : null}
    </div>
  );
}
