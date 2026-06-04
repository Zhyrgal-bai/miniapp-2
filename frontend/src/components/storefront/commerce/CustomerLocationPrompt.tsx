import type { ReactElement } from "react";
import "./customerLocationPrompt.css";

export function CustomerLocationPrompt(props: {
  open: boolean;
  requesting: boolean;
  error: string | null;
  onAllow: () => void;
  onDismiss: () => void;
}): ReactElement | null {
  if (!props.open) return null;

  return (
    <div className="sf-geo-prompt-backdrop" role="presentation">
      <div
        className="sf-geo-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-geo-prompt-title"
      >
        <h2 id="sf-geo-prompt-title" className="sf-geo-prompt__title">
          Местоположение
        </h2>
        <p className="sf-geo-prompt__text">
          Для расчёта доставки разрешите доступ к местоположению.
        </p>
        {props.error ? (
          <p className="sf-geo-prompt__error" role="alert">
            {props.error}
          </p>
        ) : null}
        <div className="sf-geo-prompt__actions">
          <button
            type="button"
            className="sf-geo-prompt__btn sf-geo-prompt__btn--primary"
            disabled={props.requesting}
            onClick={props.onAllow}
          >
            {props.requesting ? "Определяем…" : "Разрешить"}
          </button>
          <button
            type="button"
            className="sf-geo-prompt__btn sf-geo-prompt__btn--ghost"
            disabled={props.requesting}
            onClick={props.onDismiss}
          >
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  );
}
