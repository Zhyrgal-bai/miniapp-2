import { useToastStore } from "../../store/toast.store";
import "./ToastHost.css";

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-host__item toast-host__item--${t.kind}`}
          role="alert"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="toast-host__close"
            onClick={() => dismiss(t.id)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
