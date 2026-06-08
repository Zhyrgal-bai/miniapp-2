import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { formatFlowerStemCount } from "@repo-shared/businessCommerce";
import { getNormalizedVariants } from "../../../../utils/product";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import "./FlowersProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

const PACKAGING_RU: Record<string, string> = {
  paper: "Бумага",
  box: "Коробка",
};

function productAttrs(product: Product): Record<string, unknown> {
  if (
    product.attributes != null &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes)
  ) {
    return product.attributes as Record<string, unknown>;
  }
  return {};
}

function pickString(attrs: Record<string, unknown>, key: string): string | null {
  const value = attrs[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function resolveBouquetCount(product: Product): string | null {
  const attrs = productAttrs(product);
  const fromAttrs = pickString(attrs, "bouquetCount");
  if (fromAttrs) return formatFlowerStemCount(fromAttrs);
  const variants = getNormalizedVariants(product);
  const size = variants[0]?.sizes?.[0]?.size;
  if (size) return formatFlowerStemCount(size);
  return null;
}

export function FlowersProductCard(props: Props): React.ReactElement {
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
  const bouquetCount = resolveBouquetCount(product);
  const deliveryDate = pickString(attrs, "deliveryDate");
  const packagingRaw = pickString(attrs, "packaging");
  const packagingLabel = packagingRaw
    ? (PACKAGING_RU[packagingRaw] ?? packagingRaw)
    : null;

  const overlayBadges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone?: string }> = [];
    if (bouquetCount) {
      items.push({ key: "bouquet", label: bouquetCount, tone: "bouquet" });
    }
    return items;
  }, [bouquetCount]);

  const chips = useMemo(() => {
    const items: string[] = [];
    if (deliveryDate) items.push(`Доставка: ${deliveryDate}`);
    if (packagingLabel) items.push(packagingLabel);
    return items;
  }, [deliveryDate, packagingLabel]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="flowers-card__chips">
        {chips.map((chip) => (
          <span key={chip} className="flowers-card__chip">
            {chip}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="flowers-card"
      cfg={retail.cfg}
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
              <div className="flowers-card__badges">
                {overlayBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`flowers-card__badge${b.tone ? ` flowers-card__badge--${b.tone}` : ""}`}
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
