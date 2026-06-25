import { memo } from "react";

type DeliverySearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export const DeliverySearch = memo(function DeliverySearch({
  value,
  onChange,
  placeholder = "Claim ID, заказ, клиент, телефон…",
}: DeliverySearchProps) {
  return (
    <div className="dlv-search">
      <div className="dlv-search__wrap">
        <span className="dlv-search__icon" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          className="dlv-search__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Поиск доставок"
          autoComplete="off"
        />
      </div>
    </div>
  );
});
