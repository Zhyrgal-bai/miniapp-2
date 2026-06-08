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
import "./FurnitureProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolveColor(attrs: Record<string, unknown>): string | null {
  return pickString(attrs, "colorFamily") ?? pickString(attrs, "color");
}

function pickBoolean(attrs: Record<string, unknown>, key: string): boolean | null {
  const value = attrs[key];
  return typeof value === "boolean" ? value : null;
}

export function FurnitureProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const resolvedBusinessType = businessType ?? product.businessType ?? "furniture";

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig: { ...(cardConfig ?? {}), imageFit: "cover", imageRatio: "landscape" },
    textConfig,
    businessId,
    businessType: resolvedBusinessType,
  });

  const attrs = productAttrs(product);
  const dimensions = pickString(attrs, "dimensions");
  const material = pickString(attrs, "material");
  const color = resolveColor(attrs);
  const assemblyRequired = pickBoolean(attrs, "assemblyRequired");

  const badges = useMemo(
    () => computeBadges({ product, businessType: resolvedBusinessType }),
    [product, resolvedBusinessType],
  );

  const overlayBadges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone?: string }> = [];
    if (dimensions) {
      items.push({ key: "dimensions", label: dimensions, tone: "dimensions" });
    }
    for (const b of badges) {
      if (b.id === "SALE") {
        items.push({ key: b.id, label: `−${retail.discountPct}%`, tone: "sale" });
        break;
      }
    }
    if (assemblyRequired === true) {
      items.push({ key: "assembly", label: "Сборка", tone: "assembly" });
    }
    return items;
  }, [badges, dimensions, assemblyRequired, retail.discountPct]);

  const chips = useMemo(() => {
    const items: string[] = [];
    if (material) items.push(material);
    if (color) items.push(color);
    return items;
  }, [material, color]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="furniture-card__chips">
        {chips.map((chip) => (
          <span key={chip} className="furniture-card__chip">
            {chip}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="furniture-card"
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
            overlayBadges.length > 0 ? (
              <div className="furniture-card__badges">
                {overlayBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`furniture-card__badge${b.tone ? ` furniture-card__badge--${b.tone}` : ""}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
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
          telegramOpenUrl={retail.payload?.telegramOpenUrl ?? null}
          onAdd={retail.handleAddToCart}
          onIncrement={retail.handleIncrement}
          onDecrement={retail.handleDecrement}
        />
      }
    />
  );
}
