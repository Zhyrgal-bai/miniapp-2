import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { computeBadges } from "../../commerce/badgeEngine";
import { HOT_OR_COLD_RU } from "@repo-shared/businessCommerce";
import { formatSizeLabel } from "../../../../commerce/useVerticalProductSelection";
import { getNormalizedVariants } from "../../../../utils/product";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import { pickString, productAttrs } from "../shared/productAttrs";
import "./CoffeeProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolveCupSize(product: Product, businessType?: string): string | null {
  const variants = getNormalizedVariants(product);
  const size = variants[0]?.sizes?.[0]?.size ?? product.sizes?.[0]?.size;
  if (typeof size === "string" && size.trim() !== "") {
    return formatSizeLabel(businessType ?? "coffee", size.trim());
  }
  return null;
}

function resolveTemperature(attrs: Record<string, unknown>): string | null {
  const raw = pickString(attrs, "hotOrCold");
  if (!raw) return null;
  return HOT_OR_COLD_RU[raw] ?? raw;
}

export function CoffeeProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const resolvedBusinessType = businessType ?? product.businessType ?? "coffee";

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig,
    textConfig,
    businessId,
    businessType: resolvedBusinessType,
  });

  const attrs = productAttrs(product);
  const cupSize = resolveCupSize(product, resolvedBusinessType);
  const temperature = resolveTemperature(attrs);

  const badges = useMemo(
    () => computeBadges({ product, businessType: resolvedBusinessType }),
    [product, resolvedBusinessType],
  );

  const popularBadge = useMemo(() => {
    for (const b of badges) {
      if (b.id === "HOT" || b.id === "BESTSELLER" || product.isPopular) {
        return "Популярный";
      }
    }
    return product.isPopular ? "Популярный" : null;
  }, [badges, product.isPopular]);

  const chips = useMemo(() => {
    const items: string[] = [];
    if (cupSize) items.push(cupSize);
    if (temperature) items.push(temperature);
    return items;
  }, [cupSize, temperature]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="coffee-card__chips">
        {chips.map((chip) => (
          <span key={chip} className="coffee-card__chip">
            {chip}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="coffee-card"
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
            popularBadge ? (
              <div className="coffee-card__badges">
                <span className="coffee-card__badge coffee-card__badge--popular">
                  {popularBadge}
                </span>
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
