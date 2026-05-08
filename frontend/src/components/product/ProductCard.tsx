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
import { getVariantCssBackground } from "../../utils/variantColor";
import "../ui/ProductCard.css";
import { useTheme } from "../../context/ThemeContext";
import { computeBadges } from "../storefront/commerce/badgeEngine";
import { profileForBusinessType } from "../storefront/commerce/businessBehaviorProfiles";
import { computeCtaModel } from "../storefront/commerce/ctaEngine";
import { recordRecentlyViewed } from "../storefront/discovery/recentlyViewed";

type Props = {
  product: Product;
  showToast: (msg: string) => void;
  /** Открыть карточку товара (модалка на витрине). */
  onOpenDetail?: (product: Product) => void;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
  businessId?: number;
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

export default function ProductCard({ product, showToast, onOpenDetail, cardConfig, textConfig, kit = "default", businessId }: Props) {
  useTheme(); // keep existing context behavior for now (legacy vars)
  const cfg = useMemo(() => normalizeCardConfig(cardConfig), [cardConfig]);
  const addLabel =
    readTextConfigString(textConfig ?? undefined, "addToCartLabel").trim() !== ""
      ? readTextConfigString(textConfig ?? undefined, "addToCartLabel")
      : "Добавить";
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const hasCustomColors = Boolean(
    (product.colors && product.colors.length > 0) ||
      (product.variants && product.variants.length > 0)
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
    return [{ name: "default", hex: "#ffffff" }];
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
    return [{ size: "M", stock: 10 }];
  }, [product, selectedColor]);

  const outOfStock = isOutOfStock(product);
  const profile = useMemo(() => profileForBusinessType(undefined), []);

  const images = useMemo(
    () =>
      product.images && product.images.length > 0
        ? product.images
        : [product.image],
    [product]
  );

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
    if (!selectedSize) return 0;
    return sizes.find((s) => s.size === selectedSize)?.stock ?? 0;
  }, [selectedSize, sizes]);

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

  const cartItem = useMemo(() => {
    if (!selectedSize || lineColor === null) return null;
    return (
      items.find(
        (i) =>
          i.productId === product.id &&
          i.color === lineColor &&
          i.size === selectedSize
      ) ?? null
    );
  }, [items, product.id, selectedSize, lineColor]);

  const quantity = cartItem?.quantity ?? 0;

  const discountPct = getDiscountPercent(product);
  const displayPrice = getEffectivePrice(product);

  const upsertQuantity = (nextQuantity: number) => {
    if (!selectedSize || outOfStock || lineColor === null) return;
    if (selectedStock <= 0) return;

    if (cartItem) removeItem(cartItem);
    if (nextQuantity <= 0) return;

    const capped = Math.min(nextQuantity, selectedStock);
    addItem({
      productId: product.id!,
      name: product.name,
      price: displayPrice,
      image: getPrimaryImage(product),
      size: selectedSize,
      color: lineColor,
      quantity: capped,
    });
  };

  const canAddToCart =
    !outOfStock &&
    selectedSize !== null &&
    selectedStock > 0 &&
    (!hasCustomColors || lineColor !== null);

  const cta = useMemo(() => {
    const soldScore = Number(product.sold ?? 0) || 0;
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
  }, [product, profile, kit, addLabel, outOfStock, canAddToCart, quantity, totalStock]);

  const handleAddToCart = () => {
    if (!canAddToCart || lineColor === null) return;
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
    if (businessId && product.id) recordRecentlyViewed({ businessId, product });
    if (onOpenDetail) onOpenDetail(product);
  };

  const badges = useMemo(() => {
    return computeBadges({ product, kit });
  }, [product, kit]);

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
        className={`product-add-btn product-add-btn--${cta.emphasis} product-add-btn--cta-${cfg.ctaStyle}`}
        onClick={handleAddToCart}
        disabled={cta.disabled}
        type="button"
      >
        <span className="product-add-btn__label">{cta.label}</span>
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

  return (
    <div
      className={[
        "product-card",
        outOfStock ? "out" : "",
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
              <img src={img} alt="" />
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
            {hasCustomColors && (
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
            <div className="sizes">
              {sizes.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  disabled={s.stock === 0}
                  className={selectedSize === s.size ? "active" : ""}
                  onClick={() => setSelectedSize(s.size)}
                >
                  {s.size} ({s.stock})
                </button>
              ))}
            </div>
          </>
        )}

        {archetype === "fashion" ? (
          <div className="product-bottom product-bottom--fashion">
            <div className="product-price-stack">
              <div className="product-price-label">PRICE</div>
              {PriceBlock}
            </div>
            <div className="product-actions product-actions--icon">
              {quantity <= 0 ? (
                <button
                  className="product-add-btn product-add-btn--icon"
                  onClick={handleAddToCart}
                  disabled={outOfStock || !canAddToCart}
                  type="button"
                  aria-label={addLabel}
                  title={addLabel}
                >
                  +
                </button>
              ) : (
                <div className="product-actions">
                  {AddToCartButton}
                </div>
              )}
            </div>
          </div>
        ) : archetype === "luxury" ? (
          <div className="product-bottom product-bottom--luxury">
            {PriceBlock}
            <div className="product-actions product-actions--full">
              {quantity <= 0 ? (
                <button
                  className="product-add-btn product-add-btn--full"
                  onClick={handleAddToCart}
                  disabled={outOfStock || !canAddToCart}
                  type="button"
                >
                  {addLabel}
                </button>
              ) : (
                <div className="product-actions">{AddToCartButton}</div>
              )}
            </div>
          </div>
        ) : archetype === "minimal" ? (
          <div className="product-bottom product-bottom--minimal">
            {PriceBlock}
            <div className="product-actions">{AddToCartButton}</div>
          </div>
        ) : archetype === "neon" ? (
          <div className="product-bottom product-bottom--neon">
            {PriceBlock}
            <div className="product-actions product-actions--neon">{AddToCartButton}</div>
          </div>
        ) : (
          <div className="product-bottom">
            {PriceBlock}
            <div className="product-actions">{AddToCartButton}</div>
          </div>
        )}
      </div>
    </div>
  );
}
