import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../../../types";
import { useStorefrontPayload } from "../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsExperience } from "../vertical/VerticalOrderOptionsExperience";
import {
  storefrontVerticalExperience,
  verticalPdpAddLabel,
} from "../../../storefront/verticalExperience";
import type { SchemaObject } from "../../admin/DynamicFieldRenderer";
import { formatSizeLabel } from "../../../commerce/useVerticalProductSelection";
import { isStorefrontCommerceEnabled } from "../../../hooks/useStorefrontCommerceMode";
import { openOpenInTelegramModal } from "../../../storefront/openInTelegramModal";
import { getPrimaryImage, getEffectivePrice } from "../../../utils/product";
import { ru } from "../../../i18n/ru";
import { getRelatedProducts, useProductExperience } from "./useProductExperience";
import { AmbientImageGlow } from "./AmbientImageGlow";
import "./ProductExperienceScreen.css";

export type ProductExperienceScreenProps = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  /** Quick View shell — compact layout inside centered modal. */
  quickView?: boolean;
  heroFacts?: string[];
  noticeText?: string | null;
  addLabelOverride?: string | null;
  layoutId?:
    | "generic"
    | "clothing"
    | "flowers"
    | "coffee"
    | "fastfood"
    | "electronics"
    | "autoparts"
    | "cosmetics"
    | "furniture";
};

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function ProductExperienceScreen({
  product,
  businessId,
  businessType,
  catalogProducts,
  onClose,
  onSelectProduct,
  quickView = false,
  heroFacts = [],
  noticeText = null,
  addLabelOverride = null,
  layoutId = "generic",
}: ProductExperienceScreenProps): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();
  const isWeb = !commerceEnabled;

  const orderOptionsSchema = (payload?.orderOptionsSchema ?? {}) as SchemaObject;

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? null;

  const verticalExperience = storefrontVerticalExperience(resolvedBusinessType);
  const sizeBeforeColor = verticalExperience === "clothing";

  const addLabel =
    typeof addLabelOverride === "string" && addLabelOverride.trim() !== ""
      ? addLabelOverride.trim()
      : typeof payload?.storefrontTextConfig?.addToCartLabel === "string" &&
          String(payload.storefrontTextConfig.addToCartLabel).trim() !== ""
        ? String(payload.storefrontTextConfig.addToCartLabel)
        : verticalPdpAddLabel(resolvedBusinessType);

  const merchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : null;

  const px = useProductExperience({
    product,
    businessId,
    businessType: resolvedBusinessType,
    merchantConfig,
  });

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [addSuccess, setAddSuccess] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setGalleryIndex(0);
    setAddSuccess(false);
  }, [product.id]);

  useEffect(() => {
    setGalleryIndex((i) =>
      px.images.length === 0 ? 0 : Math.min(i, px.images.length - 1),
    );
  }, [px.images.length]);

  const related = useMemo(
    () => getRelatedProducts(px.display, catalogProducts, 10),
    [px.display, catalogProducts],
  );

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const onAdd = useCallback(() => {
    if (px.handleAddToCart()) {
      setAddSuccess(true);
    }
  }, [px.handleAddToCart]);

  const goToCart = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sf:navigateCart"));
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || px.images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -40) {
      setGalleryIndex((i) => Math.min(i + 1, px.images.length - 1));
    } else if (dx > 40) {
      setGalleryIndex((i) => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  const clearHint = () => px.clearSelectionHint();

  const sizeBlock =
    px.sizes.length > 0 ? (
      <section className="px-block px-block--size">
        <h2 className="px-block__label">{px.primaryLabel}</h2>
        <div className="px-chips">
          {px.sizes.map((s) => (
            <button
              key={s.size}
              type="button"
              disabled={s.stock === 0}
              className={`px-chip${px.selectedSize === s.size ? " is-active" : ""}`}
              aria-pressed={px.selectedSize === s.size}
              onClick={() => {
                px.setSelectedSize(s.size);
                clearHint();
              }}
            >
              {formatSizeLabel(resolvedBusinessType, s.size)}
            </button>
          ))}
        </div>
      </section>
    ) : null;

  const colorBlock =
    px.showColorPicker && px.hasCustomColors ? (
      <section className="px-block px-block--color">
        <h2 className="px-block__label">Цвет</h2>
        <div className="px-chips px-chips--colors">
          {px.colors.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`px-chip px-chip--color${px.selectedColor === c.name ? " is-active" : ""}`}
              aria-label={c.name}
              aria-pressed={px.selectedColor === c.name}
              style={{ ["--px-chip-color" as string]: c.hex }}
              onClick={() => {
                px.setSelectedColor(c.name);
                clearHint();
              }}
            >
              <span className="px-chip__swatch" aria-hidden />
              <span className="px-chip__text">{c.name}</span>
            </button>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div
      className={[
        "px-screen",
        isWeb ? "px-screen--web" : "px-screen--telegram",
        quickView ? "px-screen--quick-view" : "",
        `px-screen--layout-${layoutId}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical={verticalExperience !== "default" ? verticalExperience : undefined}
    >
      {isWeb && !quickView ? (
        <header className="px-topbar">
          <button type="button" className="px-topbar__back" onClick={onClose}>
            ← Назад
          </button>
        </header>
      ) : null}

      <div className="px-layout">
        <section
          className="px-gallery"
          aria-label="Фото товара"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {!quickView ? (
            <AmbientImageGlow
              src={px.images[galleryIndex] ?? px.images[0]}
              className="sf-ambient-glow--px-gallery"
            />
          ) : null}
          {px.images.length > 0 ? (
            <div
              className="px-gallery__track"
              style={{
                width: `${px.images.length * 100}%`,
                transform: `translateX(-${(galleryIndex * 100) / px.images.length}%)`,
              }}
            >
              {px.images.map((src, i) => (
                <div
                  key={i}
                  className="px-gallery__slide"
                  style={{ flex: `0 0 ${100 / px.images.length}%` }}
                >
                  <img
                    src={src}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-gallery__placeholder" aria-hidden>
              <span className="px-gallery__placeholder-icon">📷</span>
              <span className="px-gallery__placeholder-text">Нет фото</span>
            </div>
          )}
          {px.images.length > 1 ? (
            <div className="px-gallery__dots" role="tablist" aria-label="Фото товара">
              {px.images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === galleryIndex}
                  aria-label={`Фото ${i + 1} из ${px.images.length}`}
                  className={`px-gallery__dot${i === galleryIndex ? " is-active" : ""}`}
                  onClick={() => setGalleryIndex(i)}
                />
              ))}
            </div>
          ) : null}
          {px.discountPct > 0 ? (
            <span className="px-gallery__badge">−{px.discountPct}%</span>
          ) : null}
        </section>

        <div className="px-main">
          <header className="px-head">
            <h1 className="px-head__title">{px.display.name}</h1>
            <div className="px-head__price-row">
              <span className="px-head__price">{formatSom(px.displayPrice)} сом</span>
              {px.discountPct > 0 ? (
                <span className="px-head__price-old">{formatSom(px.display.price)} сом</span>
              ) : null}
            </div>
            {heroFacts.length > 0 ? (
              <div className="px-head__facts" role="list" aria-label="Характеристики">
                {heroFacts.map((fact, idx) => (
                  <span key={`${fact}-${idx}`} role="listitem" className="px-head__fact">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
            <p
              className={`px-head__status${px.outOfStock ? " px-head__status--out" : ""}`}
              role="status"
            >
              {stockLabel}
            </p>
            {px.display.description?.trim() ? (
              <p className="px-head__desc">{px.display.description.trim()}</p>
            ) : null}
            {typeof noticeText === "string" && noticeText.trim() !== "" ? (
              <p className="px-head__notice">{noticeText}</p>
            ) : null}
          </header>

          {!px.outOfStock ? (
            <>
              {sizeBeforeColor ? (
                <>
                  {sizeBlock}
                  {colorBlock}
                </>
              ) : (
                <>
                  {colorBlock}
                  {sizeBlock}
                </>
              )}

              <VerticalOrderOptionsExperience
                businessType={resolvedBusinessType}
                merchantConfig={merchantConfig}
                schema={orderOptionsSchema}
                value={px.orderOptions}
                onChange={px.setOrderOptions}
              />

              <section className="px-block px-block--qty">
                <h2 className="px-block__label">Количество</h2>
                <div className="px-qty" role="group" aria-label="Количество">
                  <button
                    type="button"
                    className="px-qty__btn"
                    aria-label="Меньше"
                    disabled={px.pickQty <= 1}
                    onClick={() => px.setPickQty((q) => Math.max(1, q - 1))}
                  >
                    −
                  </button>
                  <span className="px-qty__value">{px.pickQty}</span>
                  <button
                    type="button"
                    className="px-qty__btn"
                    aria-label="Больше"
                    disabled={!px.selectionReady || px.pickQty >= px.maxPickQty}
                    onClick={() => px.setPickQty((q) => Math.min(px.maxPickQty, q + 1))}
                  >
                    +
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {px.selectionHint ? (
            <p className="px-hint" role="alert">
              {px.selectionHint}
            </p>
          ) : null}

          {!quickView && related.length > 0 ? (
            <section className="px-block px-block--related">
              <h2 className="px-block__label">
                {ru.discovery.titleRelated}
              </h2>
              <div className="px-related-rail">
                {related.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="px-related-card"
                    onClick={() => onSelectProduct(p)}
                  >
                    <img
                      src={getPrimaryImage(p)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="px-related-card__name">{p.name}</span>
                    <span className="px-related-card__price">
                      {formatSom(getEffectivePrice(p))} сом
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div
            className={`px-sticky-spacer${addSuccess ? " px-sticky-spacer--success" : ""}`}
            aria-hidden
          />
        </div>
      </div>

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
              <span className="px-sticky__sum">{formatSom(px.displayPrice * px.pickQty)} сом</span>
              {px.pickQty > 1 ? (
                <span className="px-sticky__sum-hint">{px.pickQty} × {formatSom(px.displayPrice)}</span>
              ) : null}
            </div>
            {!commerceEnabled ? (
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--primary px-sticky__btn--wide"
                onClick={() => openOpenInTelegramModal(payload?.telegramOpenUrl ?? null)}
              >
                {px.outOfStock ? "Нет в наличии" : addLabel}
              </button>
            ) : (
              <button
                type="button"
                className="px-sticky__btn px-sticky__btn--primary px-sticky__btn--wide"
                disabled={px.addToCartDisabled}
                onClick={onAdd}
              >
                {px.outOfStock ? "Нет в наличии" : addLabel}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
