import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { computeBadges } from "../../commerce/badgeEngine";
import { SPICY_RU } from "@repo-shared/businessCommerce";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import { pickNumber, pickString, productAttrs } from "../shared/productAttrs";
import "./FastfoodProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolvePrepTimeLabel(attrs: Record<string, unknown>): string {
  const minutes = pickNumber(attrs, "preparationTimeMinutes");
  if (minutes != null && minutes > 0) {
    return `${minutes} мин`;
  }
  return "15–20 мин";
}

function resolveCaloriesLabel(attrs: Record<string, unknown>): string | null {
  const calories = pickNumber(attrs, "calories");
  if (calories == null || calories <= 0) return null;
  return `${Math.round(calories)} ккал`;
}

export function FastfoodProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig,
    textConfig,
    businessId,
    businessType,
  });

  const attrs = productAttrs(product);
  const prepTime = resolvePrepTimeLabel(attrs);
  const calories = resolveCaloriesLabel(attrs);
  const spicyRaw = pickString(attrs, "spicy");

  const badges = useMemo(
    () => computeBadges({ product, businessType: businessType ?? "fastfood" }),
    [product, businessType],
  );

  const overlayBadges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone?: string }> = [];
    for (const b of badges) {
      if (b.id === "HOT" || b.id === "BESTSELLER") {
        items.push({ key: b.id, label: "Хит", tone: "hot" });
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
      if (b.id === "SALE") {
        items.push({ key: b.id, label: `−${retail.discountPct}%`, tone: "sale" });
        break;
      }
    }
    if (spicyRaw === "hot" || spicyRaw === "mild") {
      items.push({
        key: "spicy",
        label: SPICY_RU[spicyRaw] ?? "Острое",
        tone: "spicy",
      });
    }
    return items;
  }, [badges, retail.discountPct, spicyRaw]);

  const extraMeta = (
    <div className="fastfood-card__facts">
      <span className="fastfood-card__fact">{prepTime}</span>
      {calories ? <span className="fastfood-card__fact">{calories}</span> : null}
    </div>
  );

  return (
    <RetailCardShell
      className="fastfood-card"
      cfg={{ ...retail.cfg, imageRatio: "square", imageFit: "cover" }}
      outOfStock={retail.outOfStock}
      productName={product.name}
      displayPrice={retail.displayPrice}
      originalPrice={product.price}
      discountPct={retail.discountPct}
      onOpenDetail={retail.openDetail}
      extraMeta={extraMeta}
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
            overlayBadges.length > 0 ? (
              <div className="fastfood-card__badges">
                {overlayBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`fastfood-card__badge fastfood-card__badge--${b.tone ?? "default"}`}
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
