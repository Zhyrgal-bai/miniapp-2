import { useId } from "react";
import "./catalogSearchBar.css";

export function CatalogSearchBar(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
}): React.ReactElement {
  const inputId = useId();
  const hasValue = props.value.trim() !== "";

  return (
    <section className="sf-section sf-section--search sf-section--padded" aria-label="Поиск товаров">
      <div className="sf-catalog-search">
        <label className="sf-catalog-search__label" htmlFor={inputId}>
          <span className="sf-catalog-search__icon" aria-hidden>
            🔍
          </span>
          <input
            id={inputId}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="sf-catalog-search__input"
            value={props.value}
            placeholder={props.placeholder ?? "Поиск товаров…"}
            onChange={(e) => props.onChange(e.target.value)}
          />
        </label>
        {hasValue ? (
          <button
            type="button"
            className="sf-catalog-search__clear"
            aria-label="Очистить поиск"
            onClick={() => {
              props.onChange("");
              props.onClear?.();
            }}
          >
            ✕
          </button>
        ) : null}
      </div>
    </section>
  );
}
