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

type Props = {
  product: Product;
  showToast: (msg: string) => void;
  /** Открыть карточку товара (модалка на витрине). */
  onOpenDetail?: (product: Product) => void;
};

export default function ProductCard({ product, showToast, onOpenDetail }: Props) {
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

  const handleAddToCart = () => {
    if (!canAddToCart || lineColor === null) return;
    const line = sizes.find((s) => s.size === selectedSize);
    if (!line || line.stock === 0) return;
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
    if (onOpenDetail) onOpenDetail(product);
  };

  return (
    <div className={`product-card${outOfStock ? " out" : ""}`}>
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
        {/* Instagram: шаг = currentIndex × (100% / n) ширины трека; строка «−index×100%» без деления сдвинула бы на n слайдов за раз */}
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

        <div className="product-bottom">
          <span className="product-price-block">
            {discountPct > 0 ? (
              <>
                <span className="product-price-old" aria-label="Без скидки">
                  {product.price}{" "}
                  <span className="product-price-currency">сом</span>
                </span>
                <span className="product-price product-price--sale">
                  {displayPrice}{" "}
                  <span className="product-price-currency">сом</span>
                </span>
              </>
            ) : (
              <span className="product-price">
                {product.price}{" "}
                <span className="product-price-currency">сом</span>
              </span>
            )}
          </span>

          <div className="product-actions">
            {quantity <= 0 ? (
              <button
                className="product-add-btn"
                onClick={handleAddToCart}
                disabled={outOfStock || !canAddToCart}
                type="button"
              >
                Добавить
              </button>
            ) : (
              <>
                <button
                  className="product-action-btn"
                  onClick={handleDecrement}
                  disabled={
                    outOfStock ||
                    !selectedSize ||
                    lineColor === null
                  }
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
                  disabled={
                    outOfStock ||
                    !selectedSize ||
                    lineColor === null ||
                    atMaxQty
                  }
                  type="button"
                  aria-label="Увеличить"
                >
                  +
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
