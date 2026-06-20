import { useEffect, useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { useVerticalProductSelection } from "../../../../commerce/useVerticalProductSelection";
import { formatSizeLabel } from "../../../../commerce/useVerticalProductSelection";
import { productRequiresVariantPicker } from "../../../../commerce/productVariantPolicy";
import { isAccessoryOneSize } from "@repo-shared/businessCommerce";
import { getVariantCssBackground } from "../../../../utils/variantColor";
import { useStorefrontPayload } from "../../runtime/StorefrontPayloadContext";
import { useCartStore } from "../../../../store/useCartStore";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import "./ClothingProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

const MAX_VISIBLE_SIZES = 5;

export function ClothingProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const { payload } = useStorefrontPayload();
  const merchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : null;

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? null;

  const selection = useVerticalProductSelection(product, resolvedBusinessType, {
    autoSelectDefaults: false,
    merchantConfig,
  });

  const cartItems = useCartStore((s) => s.items);

  /** If item already in cart, pre-select its size/color so qty stepper matches the line. */
  useEffect(() => {
    if (product.id == null || selection.selectedSize != null) return;
    const lines = cartItems.filter((i) => i.productId === product.id);
    if (lines.length === 0) return;
    const line = lines[0]!;
    selection.setSelectedSize(line.size);
    if (selection.hasCustomColors) {
      selection.setSelectedColor(line.color?.trim() ? line.color : "default");
    }
  }, [
    product.id,
    cartItems,
    selection.selectedSize,
    selection.hasCustomColors,
    selection.setSelectedSize,
    selection.setSelectedColor,
  ]);

  const needsVariantPicker = productRequiresVariantPicker(
    product,
    resolvedBusinessType,
    merchantConfig,
  );

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig,
    textConfig,
    businessId,
    businessType: resolvedBusinessType ?? undefined,
    selectedSize: selection.selectedSize,
    selectedColor: selection.selectedColor,
    lineColor: selection.lineColor,
    needsVariantPickerOverride: needsVariantPicker,
  });

  const visibleSizes = selection.sizes
    .filter((s) => !isAccessoryOneSize(s.size))
    .slice(0, MAX_VISIBLE_SIZES);
  const hiddenSizeCount = Math.max(
    0,
    selection.sizes.filter((s) => !isAccessoryOneSize(s.size)).length - MAX_VISIBLE_SIZES,
  );

  const stockBadge = useMemo(() => {
    if (retail.outOfStock) {
      return { label: "Нет в наличии", tone: "out" as const };
    }
    if (selection.selectedStock > 0 && selection.selectedStock <= 3) {
      return { label: `Осталось ${selection.selectedStock}`, tone: "low" as const };
    }
    return null;
  }, [retail.outOfStock, selection.selectedStock]);

  const colors = useMemo(() => {
    if (!selection.hasCustomColors) return [];
    if (product.colors?.length) return product.colors;
    if (product.variants?.length) {
      return product.variants.map((v) => ({
        name: v.color,
        hex: getVariantCssBackground(v),
      }));
    }
    return [];
  }, [product, selection.hasCustomColors]);

  const variantMeta =
    visibleSizes.length > 0 || colors.length > 0 ? (
      <div
        className="clothing-card__variants"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {visibleSizes.length > 0 ? (
          <div className="clothing-card__sizes" role="group" aria-label="Размеры">
            {visibleSizes.map((s) => (
              <button
                key={s.size}
                type="button"
                className={`clothing-card__size${selection.selectedSize === s.size ? " is-active" : ""}`}
                disabled={s.stock === 0}
                aria-pressed={selection.selectedSize === s.size}
                onClick={(e) => {
                  e.stopPropagation();
                  selection.setSelectedSize(s.size);
                }}
              >
                {formatSizeLabel(resolvedBusinessType, s.size)}
              </button>
            ))}
            {hiddenSizeCount > 0 ? (
              <span className="clothing-card__size-more">+{hiddenSizeCount}</span>
            ) : null}
          </div>
        ) : null}
        {colors.length > 0 ? (
          <div className="clothing-card__colors" role="group" aria-label="Цвета">
            {colors.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`clothing-card__color${selection.selectedColor === c.name ? " is-active" : ""}`}
                style={{ ["--clothing-card-swatch" as string]: c.hex }}
                aria-label={c.name}
                aria-pressed={selection.selectedColor === c.name}
                onClick={(e) => {
                  e.stopPropagation();
                  selection.setSelectedColor(c.name);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="clothing-card"
      cfg={retail.cfg}
      outOfStock={retail.outOfStock}
      productName={product.name}
      displayPrice={retail.displayPrice}
      originalPrice={product.price}
      discountPct={retail.discountPct}
      onOpenDetail={retail.openDetail}
      extraMeta={variantMeta}
      ctaPrimary
      media={
        <RetailCardMediaSlider
          images={retail.images}
          currentIndex={retail.currentIndex}
          primaryImage={retail.primaryCatalogImage}
          hasMultiple={retail.catalogHasMultiplePhotos}
          outOfStock={retail.outOfStock}
          discountPct={retail.discountPct}
          onTouchStart={retail.handleTouchStart}
          onTouchEnd={retail.handleTouchEnd}
          overlay={
            stockBadge ? (
              <span
                className={`clothing-card__stock clothing-card__stock--${stockBadge.tone}`}
              >
                {stockBadge.label}
              </span>
            ) : null
          }
        />
      }
      action={
        <RetailCardAction
          commerceEnabled={retail.commerceEnabled}
          quantity={retail.quantity}
          storefrontCtaLabel={retail.storefrontCtaLabel}
          outOfStock={retail.outOfStock}
          canAdjustQty={retail.canAdjustQty}
          atMaxQty={retail.atMaxQty}
          ctaPrimary
          telegramOpenUrl={retail.payload?.telegramOpenUrl ?? null}
          onAdd={retail.handleAddToCart}
          onIncrement={retail.handleIncrement}
          onDecrement={retail.handleDecrement}
        />
      }
    />
  );
}
