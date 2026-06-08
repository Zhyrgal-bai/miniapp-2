import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductColor, Size } from "../../types";
import { useCartStore } from "../../store/useCartStore";
import {
  getDiscountPercent,
  getEffectivePrice,
  getNormalizedVariants,
  getPrimaryImage,
  isOutOfStock,
} from "../../utils/product";
import { getMaxOrderQty } from "../../commerce/quantityPolicy";
import { getVariantCssBackground } from "../../utils/variantColor";
import "../ui/ProductCard.css";
import { useTheme } from "../../context/ThemeContext";
import { computeBadges } from "../storefront/commerce/badgeEngine";
import { profileForBusinessType } from "../storefront/commerce/businessBehaviorProfiles";
import { verticalUsesColorAxis, labelPrimaryOption } from "@repo-shared/businessCommerce";
import {
  cartLineIdentityKey,
  storageColorForCart,
} from "../../commerce/cartLineIdentity";
import { computeCtaModel } from "../storefront/commerce/ctaEngine";
import { recordRecentlyViewed } from "../storefront/discovery/recentlyViewed";
import {
  trackAddToCart,
  trackProductView,
} from "../../services/storefrontAnalytics";
import { isStorefrontCommerceEnabled } from "../../hooks/useStorefrontCommerceMode";
import { useStorefrontPayload } from "../storefront/runtime/StorefrontPayloadContext";
import { openOpenInTelegramModal } from "../../storefront/openInTelegramModal";
import {
  productRequiresVariantPicker,
  resolveInstantAddLine,
} from "../../commerce/productVariantPolicy";
import { verticalCatalogCtaLabel, storefrontVerticalExperience } from "../../storefront/verticalExperience";
import { formatRetailCardPrice } from "../../storefront/retailProductCard";
import { IconCart } from "../storefront/icons/StorefrontCommerceIcons";

type Props = {
  product: Product;
  showToast: (msg: string) => void;
  /** Открыть карточку товара (модалка на витрине). */
  onOpenDetail?: (product: Product) => void;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
  businessType?: string;
};

function readTextConfigString(cfg: unknown, key: string): string {
  if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) return "";
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function normalizeCardConfig(raw: Record<string, unknown> | undefined): {
  variant: "compact" | "minimal" | "modern" | "luxury" | "fashion" | "marketplace" | "neon";
  imageRatio: "square" | "portrait" | "landscape";
  imageFit: "cover" | "contain";
  imageShadow: boolean;
  rounded: boolean;
  shadow: boolean;
  compact: boolean;
  density: "compact" | "normal" | "airy";
  priceStyle: "bold" | "luxury" | "compact";
  showBadges: boolean;
  badgeStyle: "minimal" | "glow" | "luxury";
  badgePosition: "topLeft" | "topRight" | "bottomLeft";
  ctaStyle: "pill" | "square" | "glow" | "outline" | "full";
  textAlign: "left" | "center";
  hoverEffect: "none" | "scale" | "lift";
} {
  const c = raw ?? {};
  const getStr = (k: string): string | null => (typeof c[k] === "string" ? (c[k] as string) : null);
  const getBool = (k: string): boolean | null => (typeof c[k] === "boolean" ? (c[k] as boolean) : null);
  const variant =
    getStr("variant") === "compact" ||
    getStr("variant") === "minimal" ||
    getStr("variant") === "luxury" ||
    getStr("variant") === "fashion" ||
    getStr("variant") === "marketplace" ||
    getStr("variant") === "neon"
      ? (getStr("variant") as "compact" | "minimal" | "luxury" | "fashion" | "marketplace" | "neon")
      : "modern";
  const imageRatio =
    getStr("imageRatio") === "portrait" || getStr("imageRatio") === "landscape"
      ? (getStr("imageRatio") as "portrait" | "landscape")
      : "square";
  const imageFit = getStr("imageFit") === "contain" ? "contain" : "cover";
  const density =
    getStr("density") === "compact" || getStr("density") === "airy" ? (getStr("density") as "compact" | "airy") : "normal";
  const priceStyle =
    getStr("priceStyle") === "luxury" || getStr("priceStyle") === "compact"
      ? (getStr("priceStyle") as "luxury" | "compact")
      : "bold";
  const badgeStyle =
    getStr("badgeStyle") === "glow" || getStr("badgeStyle") === "luxury"
      ? (getStr("badgeStyle") as "glow" | "luxury")
      : "minimal";
  const badgePosition =
    getStr("badgePosition") === "topRight" || getStr("badgePosition") === "bottomLeft"
      ? (getStr("badgePosition") as "topRight" | "bottomLeft")
      : "topLeft";
  const ctaStyle =
    getStr("ctaStyle") === "square" ||
    getStr("ctaStyle") === "glow" ||
    getStr("ctaStyle") === "outline" ||
    getStr("ctaStyle") === "full"
      ? (getStr("ctaStyle") as "square" | "glow" | "outline" | "full")
      : "pill";
  const textAlign = getStr("textAlign") === "center" ? "center" : "left";
  const hoverEffect =
    getStr("hoverEffect") === "none" || getStr("hoverEffect") === "scale" || getStr("hoverEffect") === "lift"
      ? (getStr("hoverEffect") as "none" | "scale" | "lift")
      : "lift";
  return {
    variant,
    imageRatio,
    imageFit,
    imageShadow: getBool("imageShadow") === true,
    rounded: getBool("rounded") !== false,
    shadow: getBool("shadow") !== false,
    compact: getBool("compact") === true,
    density,
    priceStyle,
    showBadges: getBool("showBadges") !== false,
    badgeStyle,
    badgePosition,
    ctaStyle,
    textAlign,
    hoverEffect,
  };
}

export default function ProductCard({ product, showToast, onOpenDetail, cardConfig, textConfig, kit = "default", businessId, businessType }: Props) {
  useTheme(); // keep existing context behavior for now (legacy vars)
  const commerceEnabled = isStorefrontCommerceEnabled();
  const { payload } = useStorefrontPayload();
  const cfg = useMemo(() => normalizeCardConfig(cardConfig), [cardConfig]);
  const customAddLabel = readTextConfigString(textConfig ?? undefined, "addToCartLabel").trim();
  const addLabel = customAddLabel !== "" ? customAddLabel : "Добавить";
  const isStorefrontCatalog = Boolean(onOpenDetail);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const merchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : null;
  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? null;
  const showColorPicker = verticalUsesColorAxis(resolvedBusinessType, merchantConfig);

  const hasCustomColors = Boolean(
    showColorPicker &&
      ((product.colors && product.colors.length > 0) ||
        (product.variants && product.variants.length > 0)),
  );

  const colors: ProductColor[] = useMemo(() => {
    if (product.colors && product.colors.length > 0) {
      return product.colors;
    }
    if (product.variants && product.variants.length > 0) {
      return product.variants.map((v) => ({
        name: v.color,
        hex: getVariantCssBackground(v),
      }));
    }
    return [{ name: "default", hex: "var(--sf-color-muted)" }];
  }, [product]);

  const sizes = useMemo<Size[]>(() => {
    if (product.sizes && product.sizes.length > 0) {
      return product.sizes;
    }
    if (product.variants && product.variants.length > 0) {
      const v = selectedColor
        ? product.variants.find((x) => x.color === selectedColor)
        : product.variants[0];
      if (v?.sizes?.length) {
        return v.sizes;
      }
      return [];
    }
    const v0 = getNormalizedVariants(product)[0];
    if (v0?.sizes?.length) {
      return v0.sizes;
    }
    return [];
  }, [product, selectedColor]);

  const outOfStock = isOutOfStock(product);
  const needsVariantPicker = productRequiresVariantPicker(
    product,
    resolvedBusinessType,
    merchantConfig,
  );
  const showCardVariants = !onOpenDetail && !needsVariantPicker;
  const profile = useMemo(
    () => profileForBusinessType(businessType),
    [businessType],
  );

  const images = useMemo(
    () =>
      product.images && product.images.length > 0
        ? product.images
        : [product.image],
    [product]
  );

  const primaryCatalogImage = images[0] ?? product.image;

  const storefrontCtaLabel = useMemo(() => {
    if (customAddLabel !== "") return customAddLabel;
    return verticalCatalogCtaLabel(resolvedBusinessType, {
      outOfStock,
      needsVariantPicker,
    });
  }, [customAddLabel, resolvedBusinessType, outOfStock, needsVariantPicker]);

  const lineColor = useMemo(() => {
    if (hasCustomColors) {
      return (
        selectedColor ??
        product.variants?.[0]?.color ??
        getNormalizedVariants(product)[0]?.color ??
        null
      );
    }
    return getNormalizedVariants(product)[0]?.color ?? "default";
  }, [hasCustomColors, selectedColor, product]);

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const items = useCartStore((state) => state.items);

  useEffect(() => {
    setSelectedSize(null);
    setSelectedColor(null);
    setCurrentIndex(0);
  }, [product.id]);

  useEffect(() => {
    const v = product.variants;
    if (!v?.length) return;
    setSelectedColor((prev) => {
      if (prev && v.some((x) => x.color === prev)) return prev;
      return v[0]!.color;
    });
  }, [product.id, product.variants?.length, product.variants]);

  useEffect(() => {
    setCurrentIndex((i) =>
      images.length === 0 ? 0 : Math.min(i, images.length - 1)
    );
  }, [images.length]);

  const selectedStock = useMemo(() => {
    if (!selectedSize || lineColor === null) return 0;
    return getMaxOrderQty(product, selectedSize, lineColor);
  }, [selectedSize, lineColor, product]);

  const totalStock = useMemo(() => {
    if (product.variants?.length) {
      let total = 0;
      for (const v of product.variants) for (const s of v.sizes ?? []) total += Number(s.stock ?? 0) || 0;
      return total;
    }
    if (product.sizes?.length) {
      let total = 0;
      for (const s of product.sizes) total += Number(s.stock ?? 0) || 0;
      return total;
    }
    return null;
  }, [product.variants, product.sizes]);

  const storageColor = storageColorForCart(resolvedBusinessType, lineColor);

  const cartItem = useMemo(() => {
    if (!selectedSize) return null;
    const key = cartLineIdentityKey({
      productId: product.id!,
      size: selectedSize,
      color: storageColor,
    });
    return items.find((i) => cartLineIdentityKey(i) === key) ?? null;
  }, [items, product.id, selectedSize, storageColor]);

  const quantity = cartItem?.quantity ?? 0;

  const discountPct = getDiscountPercent(product);
  const displayPrice = getEffectivePrice(product);

  const upsertQuantity = (nextQuantity: number) => {
    const instant =
      !needsVariantPicker ? resolveInstantAddLine(product, resolvedBusinessType, merchantConfig) : null;
    const size = instant?.size ?? selectedSize;
    const colorKey = instant?.color ?? lineColor;
    if (!size || outOfStock || colorKey === null) return;
    const stock = getMaxOrderQty(product, size, colorKey);
    if (stock <= 0) return;

    const storage = storageColorForCart(resolvedBusinessType, colorKey);

    if (cartItem) removeItem(cartItem);
    if (nextQuantity <= 0) return;

    const capped = Math.min(nextQuantity, stock);
    addItem({
      productId: product.id!,
      name: product.name,
      price: displayPrice,
      image: getPrimaryImage(product),
      size,
      color: storage,
      quantity: capped,
    });
    if (businessId && product.id) {
      trackAddToCart(businessId, product.id);
    }
  };

  const canAddToCart = (() => {
    if (needsVariantPicker) return false;
    const instant = resolveInstantAddLine(product, resolvedBusinessType, merchantConfig);
    if (instant) {
      return (
        !outOfStock &&
        getMaxOrderQty(product, instant.size, instant.color) > 0
      );
    }
    return (
      !outOfStock &&
      selectedSize !== null &&
      selectedStock > 0 &&
      (!hasCustomColors || lineColor !== null)
    );
  })();

  const cta = useMemo(() => {
    const soldScore = Number(product.sold ?? 0) || 0;
    if (needsVariantPicker && quantity <= 0 && !outOfStock) {
      return {
        label: addLabel,
        disabled: false,
        emphasis: "primary" as const,
        state: "ready" as const,
      };
    }
    return computeCtaModel({
      product,
      profile,
      kit,
      addLabelOverride: addLabel,
      outOfStock,
      selectionComplete: canAddToCart,
      inCartQty: quantity,
      stockLeft: totalStock,
      soldScore,
    });
  }, [product, profile, kit, addLabel, outOfStock, canAddToCart, quantity, totalStock, needsVariantPicker]);

  const handleAddToCart = () => {
    if (needsVariantPicker && onOpenDetail) {
      openDetail();
      return;
    }
    if (!canAddToCart) return;
    const instant = resolveInstantAddLine(product, resolvedBusinessType, merchantConfig);
    if (instant) {
      if (businessId && product.id) recordRecentlyViewed({ businessId, product });
      upsertQuantity(1);
      showToast("Добавлено в корзину");
      return;
    }
    if (lineColor === null) return;
    const line = sizes.find((s) => s.size === selectedSize);
    if (!line || line.stock === 0) return;
    if (businessId && product.id) recordRecentlyViewed({ businessId, product });
    upsertQuantity(1);
    showToast("Добавлено в корзину");
  };

  const handleIncrement = () => {
    if (quantity >= selectedStock) return;
    upsertQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    upsertQuantity(quantity - 1);
  };

  const atMaxQty = quantity >= selectedStock && selectedStock > 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40;
    if (dx < -threshold) {
      setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
    } else if (dx > threshold) {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  const openDetail = () => {
    if (businessId && product.id) {
      recordRecentlyViewed({ businessId, product });
      trackProductView(businessId, product.id);
    }
    if (onOpenDetail) onOpenDetail(product);
  };

  const badges = useMemo(() => {
    return computeBadges({ product, businessType, kit });
  }, [product, kit, businessType]);

  const badgeClass = (id: string): string => {
    switch (id) {
      case "NEW":
        return "new";
      case "HOT":
        return "hot";
      case "SALE":
        return "sale";
      case "LIMITED":
        return "limited";
      case "LOW_STOCK":
        return "low";
      case "BESTSELLER":
        return "best";
      default:
        return "new";
    }
  };

  const archetype: "compact" | "marketplace" | "luxury" | "fashion" | "minimal" | "neon" = useMemo(() => {
    if (cfg.variant === "compact") return "compact";
    if (cfg.variant === "marketplace") return "marketplace";
    if (cfg.variant === "luxury") return "luxury";
    if (cfg.variant === "fashion") return "fashion";
    if (cfg.variant === "minimal") return "minimal";
    if (cfg.variant === "neon") return "neon";
    if (kit === "luxury") return "luxury";
    if (kit === "fashion") return "fashion";
    if (kit === "neon") return "neon";
    if (kit === "minimal") return "minimal";
    return "marketplace";
  }, [cfg.variant, kit]);

  const PriceBlock = (
    <span className="product-price-block">
      {discountPct > 0 ? (
        <>
          <span className="product-price-old" aria-label="Без скидки">
            {product.price} <span className="product-price-currency">сом</span>
          </span>
          <span className="product-price product-price--sale">
            {displayPrice} <span className="product-price-currency">сом</span>
          </span>
        </>
      ) : (
        <span className="product-price">
          {product.price} <span className="product-price-currency">сом</span>
        </span>
      )}
    </span>
  );

  const AddToCartButton =
    quantity <= 0 ? (
      <button
        className={`product-add-btn product-add-btn--modern product-add-btn--${cta.emphasis} product-add-btn--cta-${cfg.ctaStyle}`}
        onClick={handleAddToCart}
        disabled={cta.disabled}
        type="button"
      >
        <span className="product-add-btn__icon" aria-hidden>
          <IconCart size={16} />
        </span>
        <span className="product-add-btn__label">{cta.label || addLabel}</span>
        {cta.sublabel ? <span className="product-add-btn__sub">{cta.sublabel}</span> : null}
      </button>
    ) : (
      <>
        <button
          className="product-action-btn"
          onClick={handleDecrement}
          disabled={outOfStock || !selectedSize || lineColor === null}
          type="button"
          aria-label="Уменьшить"
        >
          -
        </button>
        <span className="product-qty" aria-label="Количество">
          {quantity}
        </span>
        <button
          className="product-action-btn"
          onClick={handleIncrement}
          disabled={outOfStock || !selectedSize || lineColor === null || atMaxQty}
          type="button"
          aria-label="Увеличить"
        >
          +
        </button>
      </>
    );

  const purchaseControl = commerceEnabled ? (
    AddToCartButton
  ) : (
    <button
      type="button"
      className="product-add-btn product-add-btn--modern"
      onClick={() =>
        openOpenInTelegramModal(payload?.telegramOpenUrl ?? null)
      }
    >
      <span className="product-add-btn__icon" aria-hidden>
        <IconCart size={16} />
      </span>
      <span className="product-add-btn__label">{addLabel}</span>
    </button>
  );

  const webStorefrontButton = (
    <button
      type="button"
      className="product-add-btn product-add-btn--storefront-retail"
      onClick={(e) => {
        e.stopPropagation();
        openOpenInTelegramModal(payload?.telegramOpenUrl ?? null);
      }}
    >
      <IconCart size={15} />
      <span className="product-add-btn__label">{addLabel}</span>
    </button>
  );

  const storefrontRetailControl =
    isStorefrontCatalog && commerceEnabled && !outOfStock ? (
      quantity <= 0 ? (
        <button
          type="button"
          className="product-add-btn product-add-btn--storefront-retail"
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          disabled={outOfStock}
          aria-label={storefrontCtaLabel}
        >
          <span className="product-add-btn__label">{storefrontCtaLabel}</span>
        </button>
      ) : (
        <div
          className="product-actions product-actions--storefront-qty"
          onClick={(e) => e.stopPropagation()}
        >
          {purchaseControl}
        </div>
      )
    ) : null;

  const verticalExp = storefrontVerticalExperience(resolvedBusinessType);
  const retailCtaPrimary =
    verticalExp === "coffee" || verticalExp === "fastfood" || verticalExp === "flowers";

  if (isStorefrontCatalog) {
    const retailCardClasses = [
      "product-card",
      "product-card--storefront",
      "product-card--retail-v1",
      outOfStock ? "out" : "",
      `product-card--ratio-${cfg.imageRatio}`,
      `product-card--fit-${cfg.imageFit}`,
      cfg.rounded ? "product-card--rounded" : "product-card--square",
      `product-card--density-${cfg.density}`,
      `product-card--price-${cfg.priceStyle}`,
    ]
      .filter(Boolean)
      .join(" ");

    const retailAction =
      !commerceEnabled ? (
        <button
          type="button"
          className={`retail-card__cta${retailCtaPrimary ? " retail-card__cta--primary" : ""}`}
          onClick={() => openOpenInTelegramModal(payload?.telegramOpenUrl ?? null)}
        >
          <span className="retail-card__cta-label">{addLabel}</span>
        </button>
      ) : quantity <= 0 ? (
        <button
          type="button"
          className={`retail-card__cta${retailCtaPrimary ? " retail-card__cta--primary" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          disabled={outOfStock}
          aria-label={storefrontCtaLabel}
        >
          <span className="retail-card__cta-label">{storefrontCtaLabel}</span>
        </button>
      ) : (
        <div className="retail-card__qty" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="retail-card__qty-btn"
            onClick={handleDecrement}
            disabled={outOfStock || !selectedSize || lineColor === null}
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
            onClick={handleIncrement}
            disabled={outOfStock || !selectedSize || lineColor === null || atMaxQty}
            aria-label="Увеличить"
          >
            +
          </button>
        </div>
      );

    return (
      <article className={retailCardClasses}>
        <div className="retail-card">
          <button
            type="button"
            className="retail-card__tap"
            onClick={openDetail}
            aria-label={`${product.name}, ${formatRetailCardPrice(displayPrice)}`}
          >
            <div className="retail-card__media">
              <img
                className="retail-card__img"
                src={primaryCatalogImage}
                alt=""
                sizes="(min-width: 1200px) 220px, (min-width: 900px) 20vw, (min-width: 600px) 28vw, 48vw"
                loading="lazy"
                decoding="async"
              />
              {outOfStock ? (
                <span className="retail-card__oos">Нет в наличии</span>
              ) : discountPct > 0 ? (
                <span className="retail-card__discount">−{discountPct}%</span>
              ) : null}
            </div>
            <div className="retail-card__meta">
              <h3 className="retail-card__title">{product.name}</h3>
              <div className="retail-card__price">
                {discountPct > 0 ? (
                  <>
                    <span className="retail-card__price-current retail-card__price-current--sale">
                      {formatRetailCardPrice(displayPrice)}
                    </span>
                    <span className="retail-card__price-was">{formatRetailCardPrice(product.price)}</span>
                  </>
                ) : (
                  <span className="retail-card__price-current">
                    {formatRetailCardPrice(product.price)}
                  </span>
                )}
              </div>
            </div>
          </button>
          <div className="retail-card__action">{retailAction}</div>
        </div>
      </article>
    );
  }

  return (
    <div
      className={[
        "product-card",
        outOfStock ? "out" : "",
        onOpenDetail ? "product-card--storefront" : "",
        `product-card--variant-${cfg.variant}`,
        `product-card--ratio-${cfg.imageRatio}`,
        `product-card--fit-${cfg.imageFit}`,
        cfg.imageShadow ? "product-card--img-shadow" : "",
        cfg.rounded ? "product-card--rounded" : "product-card--square",
        cfg.shadow ? "product-card--shadow" : "product-card--flat",
        cfg.compact ? "product-card--compact" : "",
        `product-card--density-${cfg.density}`,
        `product-card--price-${cfg.priceStyle}`,
        `product-card--align-${cfg.textAlign}`,
        `product-card--hover-${cfg.hoverEffect}`,
        `product-card--arch-${archetype}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Archetype-specific composition */}
      <div
        className={`product-image-wrapper${onOpenDetail ? " product-image-wrapper--detail" : ""}`}
        onTouchStart={isStorefrontCatalog ? undefined : handleTouchStart}
        onTouchEnd={isStorefrontCatalog ? undefined : handleTouchEnd}
        onClick={() => onOpenDetail && openDetail()}
        onKeyDown={(e) => {
          if (!onOpenDetail) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        }}
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        aria-label={onOpenDetail ? "Подробнее о товаре" : undefined}
      >
        {isStorefrontCatalog ? (
          <img
            className="product-catalog-image"
            src={primaryCatalogImage}
            alt=""
            sizes="(min-width: 1200px) 220px, (min-width: 900px) 20vw, (min-width: 600px) 28vw, 48vw"
            loading="eager"
            decoding="async"
          />
        ) : (
          <>
            <div
              className="image-slider"
              style={
                {
                  ["--slide-count" as string]: images.length,
                  width: "calc(var(--slide-count) * 100%)",
                  transform: `translateX(calc(-${currentIndex} * 100% / var(--slide-count)))`,
                } as React.CSSProperties
              }
            >
              {images.map((img, index) => (
                <div key={index} className="image-slide">
                  <img
                    src={img}
                    alt=""
                    sizes="(min-width: 1200px) 220px, (min-width: 900px) 20vw, (min-width: 600px) 28vw, 48vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              ))}
            </div>
            <div className="dots">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={i === currentIndex ? "active" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
        {isStorefrontCatalog && images.length > 1 ? (
          <span className="product-photo-count-badge" aria-label={`Ещё ${images.length - 1} фото`}>
            +{images.length - 1} фото
          </span>
        ) : null}
        {cfg.showBadges ? badges.slice(0, 2).map((b) => (
          <div
            key={b.id}
            className={[
              "product-badge",
              `product-badge--${badgeClass(b.id)}`,
              `product-badge--style-${cfg.badgeStyle}`,
              `product-badge--pos-${cfg.badgePosition}`,
            ].join(" ")}
            style={badges[0]?.id === b.id ? undefined : { top: cfg.badgePosition.startsWith("bottom") ? undefined : 44 }}
          >
            {b.label}
          </div>
        )) : null}
      </div>

      <div className="product-info">
        <h3
          className={`product-title${onOpenDetail ? " product-title--detail" : ""}`}
          onClick={onOpenDetail ? openDetail : undefined}
          onKeyDown={
            onOpenDetail
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                  }
                }
              : undefined
          }
          role={onOpenDetail ? "button" : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
        >
          {product.name}
        </h3>

        {outOfStock ? (
          <div className="out-of-stock">НЕТ В НАЛИЧИИ</div>
        ) : (
          <>
            {showCardVariants && hasCustomColors && (
              <div className="colors">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    aria-label={c.name}
                    style={{ background: c.hex }}
                    className={selectedColor === c.name ? "active" : ""}
                    onClick={() => setSelectedColor(c.name)}
                  />
                ))}
              </div>
            )}
            {showCardVariants ? (
            <div className="product-tiers">
              {sizes.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  disabled={s.stock === 0}
                  className={selectedSize === s.size ? "active" : ""}
                  onClick={() => setSelectedSize(s.size)}
                >
                  {labelPrimaryOption(resolvedBusinessType, s.size)}
                  {s.stock > 0 ? ` (${s.stock})` : ""}
                </button>
              ))}
            </div>
            ) : null}
          </>
        )}

        {onOpenDetail ? (
          <div className="product-bottom product-bottom--storefront">
            {PriceBlock}
            <div className="product-actions product-actions--storefront-retail">
              {!commerceEnabled ? webStorefrontButton : storefrontRetailControl}
            </div>
          </div>
        ) : archetype === "fashion" ? (
          <div className="product-bottom product-bottom--fashion">
            <div className="product-price-stack">
              <div className="product-price-label">PRICE</div>
              {PriceBlock}
            </div>
            <div className="product-actions product-actions--icon">
              {!commerceEnabled ? (
                webStorefrontButton
              ) : quantity <= 0 ? (
                <button
                  className="product-add-btn product-add-btn--storefront-retail product-add-btn--compact"
                  onClick={handleAddToCart}
                  disabled={outOfStock || !canAddToCart}
                  type="button"
                  aria-label={addLabel}
                >
                  <IconCart size={15} />
                  <span className="product-add-btn__label">{addLabel}</span>
                </button>
              ) : (
                <div className="product-actions">{purchaseControl}</div>
              )}
            </div>
          </div>
        ) : archetype === "luxury" ? (
          <div className="product-bottom product-bottom--luxury">
            {PriceBlock}
            <div className="product-actions product-actions--full">
              {!commerceEnabled ? (
                purchaseControl
              ) : quantity <= 0 ? (
                <button
                  className="product-add-btn product-add-btn--full product-add-btn--modern"
                  onClick={handleAddToCart}
                  disabled={outOfStock || !canAddToCart}
                  type="button"
                >
                  <span className="product-add-btn__icon" aria-hidden>
                    <IconCart size={16} />
                  </span>
                  <span className="product-add-btn__label">{addLabel}</span>
                </button>
              ) : (
                <div className="product-actions">{purchaseControl}</div>
              )}
            </div>
          </div>
        ) : archetype === "minimal" ? (
          <div className="product-bottom product-bottom--minimal">
            {PriceBlock}
            <div className="product-actions">{purchaseControl}</div>
          </div>
        ) : archetype === "neon" ? (
          <div className="product-bottom product-bottom--neon">
            {PriceBlock}
            <div className="product-actions product-actions--neon">{purchaseControl}</div>
          </div>
        ) : (
          <div className="product-bottom">
            {PriceBlock}
            <div className="product-actions">{purchaseControl}</div>
          </div>
        )}
      </div>
    </div>
  );
}
