import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { computeBadges } from "../../commerce/badgeEngine";
import { useVerticalProductSelection } from "../../../../commerce/useVerticalProductSelection";
import { formatSizeLabel } from "../../../../commerce/useVerticalProductSelection";
import { productRequiresVariantPicker } from "../../../../commerce/productVariantPolicy";
import { getNormalizedVariants } from "../../../../utils/product";
import { useStorefrontPayload } from "../../runtime/StorefrontPayloadContext";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import { pickString, productAttrs } from "../shared/productAttrs";
import "./ElectronicsProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolveMemoryPreview(product: Product, businessType?: string): string | null {
  const variants = getNormalizedVariants(product);
  const firstSize = variants[0]?.sizes?.[0]?.size;
  if (typeof firstSize === "string" && firstSize.trim() !== "") {
    return formatSizeLabel(businessType ?? "electronics", firstSize.trim());
  }
  return null;
}

export function ElectronicsProductCard(props: Props): React.ReactElement {
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
    businessType ?? product.businessType ?? payload?.businessType ?? "electronics";

  const selection = useVerticalProductSelection(product, resolvedBusinessType, {
    autoSelectDefaults: false,
    merchantConfig,
  });

  const needsVariantPicker = productRequiresVariantPicker(
    product,
    resolvedBusinessType,
    merchantConfig,
  );

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig: { ...(cardConfig ?? {}), imageFit: "contain", imageRatio: "square" },
    textConfig,
    businessId,
    businessType: resolvedBusinessType,
    selectedSize: selection.selectedSize,
    selectedColor: selection.selectedColor,
    lineColor: selection.lineColor,
    needsVariantPickerOverride: needsVariantPicker,
  });

  const attrs = productAttrs(product);
  const brand = pickString(attrs, "brand");
  const warranty = pickString(attrs, "warranty");
  const memoryPreview = resolveMemoryPreview(product, resolvedBusinessType);

  const badges = useMemo(
    () => computeBadges({ product, businessType: resolvedBusinessType }),
    [product, resolvedBusinessType],
  );

  const overlayBadges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone?: string }> = [];
    for (const b of badges) {
      if (b.id === "SALE") {
        items.push({ key: b.id, label: `−${retail.discountPct}%`, tone: "sale" });
        break;
      }
    }
    for (const b of badges) {
      if (b.id === "NEW") {
        items.push({ key: b.id, label: "Новинка", tone: "new" });
        break;
      }
    }
    for (const b of badges) {
      if (b.id === "HOT" || b.id === "BESTSELLER") {
        items.push({ key: b.id, label: "Хит", tone: "new" });
        break;
      }
    }
    return items;
  }, [badges, retail.discountPct]);

  const stockBadge = useMemo(() => {
    if (retail.outOfStock) {
      return { label: "Нет в наличии", tone: "out" as const };
    }
    if (selection.selectedStock > 0 && selection.selectedStock <= 3) {
      return { label: `Осталось ${selection.selectedStock}`, tone: "low" as const };
    }
    return { label: "В наличии", tone: "in" as const };
  }, [retail.outOfStock, selection.selectedStock]);

  const chips = useMemo(() => {
    const items: string[] = [];
    if (brand) items.push(brand);
    if (warranty) items.push(warranty);
    if (memoryPreview) items.push(memoryPreview);
    return items;
  }, [brand, warranty, memoryPreview]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="electronics-card__chips">
        {chips.map((chip) => (
          <span key={chip} className="electronics-card__chip">
            {chip}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="electronics-card"
      cfg={retail.cfg}
      outOfStock={retail.outOfStock}
      productName={product.name}
      displayPrice={retail.displayPrice}
      originalPrice={product.price}
      discountPct={retail.discountPct}
      onOpenDetail={retail.openDetail}
      extraMeta={extraMeta}
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
            <>
              {overlayBadges.length > 0 ? (
                <div className="electronics-card__badges">
                  {overlayBadges.map((b) => (
                    <span
                      key={b.key}
                      className={`electronics-card__badge${b.tone ? ` electronics-card__badge--${b.tone}` : ""}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <span
                className={`electronics-card__stock${stockBadge.tone !== "in" ? ` electronics-card__stock--${stockBadge.tone}` : ""}`}
              >
                {stockBadge.label}
              </span>
            </>
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
          telegramOpenUrl={retail.payload?.telegramOpenUrl ?? null}
          onAdd={retail.handleAddToCart}
          onIncrement={retail.handleIncrement}
          onDecrement={retail.handleDecrement}
        />
      }
    />
  );
}
