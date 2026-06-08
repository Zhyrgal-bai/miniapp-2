import { useMemo } from "react";
import type { Product } from "../../../../types";
import ProductCard from "../../../product/ProductCard";
import { SKIN_TYPE_RU } from "@repo-shared/businessCommerce";
import { computeBadges } from "../../commerce/badgeEngine";
import { useStorefrontRetailCard } from "./shared/useStorefrontRetailCard";
import {
  RetailCardAction,
  RetailCardMediaSlider,
  RetailCardShell,
} from "./shared/RetailCardShell";
import { pickString, productAttrs } from "../shared/productAttrs";
import "./CosmeticsProductCard.css";

type Props = React.ComponentProps<typeof ProductCard> & { product: Product };

function resolveSkinTypeLabel(raw: string | null): string | null {
  if (!raw || raw === "all") return null;
  return SKIN_TYPE_RU[raw] ?? raw;
}

export function CosmeticsProductCard(props: Props): React.ReactElement {
  const { product, showToast, onOpenDetail, cardConfig, textConfig, businessId, businessType } =
    props;

  const resolvedBusinessType = businessType ?? product.businessType ?? "cosmetics";

  const retail = useStorefrontRetailCard({
    product,
    showToast,
    onOpenDetail,
    cardConfig: { ...(cardConfig ?? {}), imageFit: "cover", imageRatio: "portrait" },
    textConfig,
    businessId,
    businessType: resolvedBusinessType,
  });

  const attrs = productAttrs(product);
  const shade = pickString(attrs, "shade");
  const volume = pickString(attrs, "volume");
  const skinType = resolveSkinTypeLabel(pickString(attrs, "skinType"));

  const badges = useMemo(
    () => computeBadges({ product, businessType: resolvedBusinessType }),
    [product, resolvedBusinessType],
  );

  const overlayBadges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone?: string }> = [];
    if (shade) {
      items.push({ key: "shade", label: shade, tone: "shade" });
    }
    for (const b of badges) {
      if (b.id === "SALE") {
        items.push({ key: b.id, label: `−${retail.discountPct}%`, tone: "sale" });
        break;
      }
    }
    return items;
  }, [badges, retail.discountPct, shade]);

  const chips = useMemo(() => {
    const items: string[] = [];
    if (volume) items.push(volume);
    if (skinType) items.push(skinType);
    return items;
  }, [volume, skinType]);

  const extraMeta =
    chips.length > 0 ? (
      <div className="cosmetics-card__chips">
        {chips.map((chip) => (
          <span key={chip} className="cosmetics-card__chip">
            {chip}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <RetailCardShell
      className="cosmetics-card"
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
              <div className="cosmetics-card__badges">
                {overlayBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`cosmetics-card__badge${b.tone ? ` cosmetics-card__badge--${b.tone}` : ""}`}
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
