import type { ReactNode } from "react";
import { formatRetailCardPrice } from "../../../../../storefront/retailProductCard";
import { openOpenInTelegramModal } from "../../../../../storefront/openInTelegramModal";
import type { RetailCardConfig } from "./normalizeRetailCardConfig";
import "../../retailProductCard.css";

type Props = {
  cfg: RetailCardConfig;
  outOfStock: boolean;
  productName: string;
  displayPrice: number;
  originalPrice: number;
  discountPct: number;
  onOpenDetail: () => void;
  media: ReactNode;
  action: ReactNode;
  extraMeta?: ReactNode;
  cardHint?: string;
  className?: string;
  ctaPrimary?: boolean;
};

export function RetailCardShell({
  cfg,
  outOfStock,
  productName,
  displayPrice,
  originalPrice,
  discountPct,
  onOpenDetail,
  media,
  action,
  extraMeta,
  cardHint,
  className,
  ctaPrimary = false,
}: Props): React.ReactElement {
  const retailCardClasses = [
    "product-card",
    "product-card--storefront",
    "product-card--retail-v1",
    outOfStock ? "out" : "",
    className ?? "",
    `product-card--ratio-${cfg.imageRatio}`,
    `product-card--fit-${cfg.imageFit}`,
    cfg.rounded ? "product-card--rounded" : "product-card--square",
    `product-card--density-${cfg.density}`,
    `product-card--price-${cfg.priceStyle}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={retailCardClasses}>
      <div className="retail-card">
        <button
          type="button"
          className="retail-card__tap"
          onClick={onOpenDetail}
          aria-label={`${productName}, ${formatRetailCardPrice(displayPrice)}`}
        >
          {media}
          <div className="retail-card__meta">
            <h3 className="retail-card__title">{productName}</h3>
            {cardHint ? <p className="retail-card__hint">{cardHint}</p> : null}
            {extraMeta}
            <div className="retail-card__price">
              {discountPct > 0 ? (
                <>
                  <span className="retail-card__price-current retail-card__price-current--sale">
                    {formatRetailCardPrice(displayPrice)}
                  </span>
                  <span className="retail-card__price-was">
                    {formatRetailCardPrice(originalPrice)}
                  </span>
                </>
              ) : (
                <span className="retail-card__price-current">
                  {formatRetailCardPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>
        </button>
        <div
          className={`retail-card__action${ctaPrimary ? " retail-card__action--primary" : ""}`}
        >
          {action}
        </div>
      </div>
    </article>
  );
}

export function RetailCardMediaSlider({
  images,
  currentIndex,
  primaryImage,
  hasMultiple,
  outOfStock,
  discountPct,
  onTouchStart,
  onTouchEnd,
  overlay,
}: {
  images: string[];
  currentIndex: number;
  primaryImage: string;
  hasMultiple: boolean;
  outOfStock: boolean;
  discountPct: number;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  overlay?: ReactNode;
}): React.ReactElement {
  return (
    <div
      className="retail-card__media"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {hasMultiple ? (
        <div
          className="retail-card__slider"
          style={
            {
              ["--slide-count" as string]: images.length,
              width: "calc(var(--slide-count) * 100%)",
              transform: `translateX(calc(-${currentIndex} * 100% / var(--slide-count)))`,
            } as React.CSSProperties
          }
        >
          {images.map((img, index) => (
            <div key={index} className="retail-card__slide">
              <img
                className="retail-card__img"
                src={img}
                alt=""
                sizes="(min-width: 1200px) 220px, (min-width: 900px) 20vw, (min-width: 600px) 28vw, 48vw"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
          ))}
        </div>
      ) : (
        <img
          className="retail-card__img"
          src={primaryImage}
          alt=""
          sizes="(min-width: 1200px) 220px, (min-width: 900px) 20vw, (min-width: 600px) 28vw, 48vw"
          loading="lazy"
          decoding="async"
        />
      )}
      {hasMultiple ? (
        <div className="retail-card__dots" aria-hidden>
          {images.map((_, i) => (
            <span
              key={i}
              className={`retail-card__dot${i === currentIndex ? " is-active" : ""}`}
            />
          ))}
        </div>
      ) : null}
      {overlay}
      {outOfStock ? (
        <span className="retail-card__oos">Нет в наличии</span>
      ) : discountPct > 0 ? (
        <span className="retail-card__discount">−{discountPct}%</span>
      ) : null}
    </div>
  );
}

export function RetailCardAction({
  commerceEnabled,
  quantity,
  storefrontCtaLabel,
  outOfStock,
  canAdjustQty,
  atMaxQty,
  ctaPrimary,
  telegramOpenUrl,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  commerceEnabled: boolean;
  quantity: number;
  storefrontCtaLabel: string;
  outOfStock: boolean;
  canAdjustQty: boolean;
  atMaxQty: boolean;
  ctaPrimary?: boolean;
  telegramOpenUrl?: string | null;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}): React.ReactElement {
  if (!commerceEnabled) {
    return (
      <button
        type="button"
        className={`retail-card__cta${ctaPrimary ? " retail-card__cta--primary" : ""}`}
        onClick={() => openOpenInTelegramModal(telegramOpenUrl ?? null)}
      >
        <span className="retail-card__cta-label">{storefrontCtaLabel}</span>
      </button>
    );
  }

  if (quantity <= 0) {
    return (
      <button
        type="button"
        className={`retail-card__cta${ctaPrimary ? " retail-card__cta--primary" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        disabled={outOfStock}
        aria-label={storefrontCtaLabel}
      >
        <span className="retail-card__cta-label">{storefrontCtaLabel}</span>
      </button>
    );
  }

  return (
    <div className="retail-card__qty" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="retail-card__qty-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDecrement();
        }}
        disabled={!canAdjustQty}
        aria-label="Уменьшить"
      >
        −
      </button>
      <span className="retail-card__qty-value" aria-label="Количество">
        {quantity}
      </span>
      <button
        type="button"
        className="retail-card__qty-btn"
        onClick={(e) => {
          e.stopPropagation();
          onIncrement();
        }}
        disabled={!canAdjustQty || atMaxQty}
        aria-label="Увеличить"
      >
        +
      </button>
    </div>
  );
}
