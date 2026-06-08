import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { computeBadges } from "../../commerce/badgeEngine";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import { pickString, productAttrs } from "../shared/productAttrs";
import "./AutopartsProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolveCompatibilityLabel(attrs: Record<string, unknown>): string | null {
  return (
    pickString(attrs, "compatibility") ??
    pickString(attrs, "compatibleModels")
  );
}

export function AutopartsProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const resolvedBusinessType = businessType ?? product.businessType ?? "autoparts";

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig: { ...(cardConfig ?? {}), imageFit: "contain", imageRatio: "square" },
    textConfig: { ...(textConfig ?? {}), addToCartLabel: "Подобрать" },
    businessId,
    businessType: resolvedBusinessType,
  });

  const attrs = productAttrs(product);
  const brand = pickString(attrs, "brand");
  const sku = pickString(attrs, "sku");
  const compatibility = resolveCompatibilityLabel(attrs);

  const badges = useMemo(
    () => computeBadges({ product, businessType: resolvedBusinessType }),
    [product, resolvedBusinessType],
  );

  const saleBadge = useMemo(() => {
    for (const b of badges) {
      if (b.id === "SALE") return `−${retail.discountPct}%`;
    }
    return null;
  }, [badges, retail.discountPct]);

  const stockBadge = useMemo(() => {
    if (retail.outOfStock) {
      return { label: "Нет в наличии", tone: "out" as const };
    }
    if (typeof product.totalAvailable === "number" && product.totalAvailable > 0 && product.totalAvailable <= 3) {
      return { label: `Осталось ${product.totalAvailable}`, tone: "low" as const };
    }
    return { label: "В наличии", tone: "in" as const };
  }, [retail.outOfStock, product.totalAvailable]);

  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; sku?: boolean }> = [];
    if (brand) items.push({ key: "brand", label: brand });
    if (sku) items.push({ key: "sku", label: sku, sku: true });
    if (compatibility) items.push({ key: "compat", label: compatibility });
    return items;
  }, [brand, sku, compatibility]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="autoparts-card__chips">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className={`autoparts-card__chip${chip.sku ? " autoparts-card__chip--sku" : ""}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="autoparts-card"
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
              {saleBadge ? (
                <div className="autoparts-card__badges">
                  <span className="autoparts-card__badge autoparts-card__badge--sale">
                    {saleBadge}
                  </span>
                </div>
              ) : null}
              <span
                className={`autoparts-card__stock${stockBadge.tone !== "in" ? ` autoparts-card__stock--${stockBadge.tone}` : ""}`}
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
