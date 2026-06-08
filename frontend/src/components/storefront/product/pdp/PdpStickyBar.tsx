import { useCallback, useState } from "react";
import { isStorefrontCommerceEnabled } from "../../../../hooks/useStorefrontCommerceMode";
import { openOpenInTelegramModal } from "../../../../storefront/openInTelegramModal";

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

type Props = {
  outOfStock: boolean;
  addLabel: string;
  displayPrice: number;
  pickQty: number;
  addToCartDisabled: boolean;
  onAdd: () => boolean;
  telegramOpenUrl?: string | null;
};

export function PdpStickyBar({
  outOfStock,
  addLabel,
  displayPrice,
  pickQty,
  addToCartDisabled,
  onAdd,
  telegramOpenUrl,
}: Props): React.ReactElement {
  const commerceEnabled = isStorefrontCommerceEnabled();
  const [addSuccess, setAddSuccess] = useState(false);

  const goToCart = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sf:navigateCart"));
  }, []);

  const handleAdd = useCallback(() => {
    if (onAdd()) {
      setAddSuccess(true);
    }
  }, [onAdd]);

  return (
    <>
      <div
        className={`px-sticky-spacer${addSuccess ? " px-sticky-spacer--success" : ""}`}
        aria-hidden
      />
      <footer className="px-sticky">
        {addSuccess && commerceEnabled ? (
          <div className="px-sticky__success">
            <p className="px-sticky__success-msg">✓ Добавлено в корзину</p>
            <div className="px-sticky__success-actions">
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--ghost"
                onClick={() => setAddSuccess(false)}
              >
                Продолжить покупки
              </button>
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--primary"
                onClick={goToCart}
              >
                Перейти в корзину
              </button>
            </div>
          </div>
        ) : (
          <div className="px-sticky__buy">
            <div className="px-sticky__price-col">
              <span className="px-sticky__sum">{formatSom(displayPrice * pickQty)} сом</span>
              {pickQty > 1 ? (
                <span className="px-sticky__sum-hint">
                  {pickQty} × {formatSom(displayPrice)}
                </span>
              ) : null}
            </div>
            {!commerceEnabled ? (
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--primary px-sticky__btn--wide"
                onClick={() => openOpenInTelegramModal(telegramOpenUrl ?? null)}
              >
                {outOfStock ? "Нет в наличии" : addLabel}
              </button>
            ) : (
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--primary px-sticky__btn--wide"
                disabled={addToCartDisabled}
                onClick={handleAdd}
              >
                {outOfStock ? "Нет в наличии" : addLabel}
              </button>
            )}
          </div>
        )}
      </footer>
    </>
  );
}
