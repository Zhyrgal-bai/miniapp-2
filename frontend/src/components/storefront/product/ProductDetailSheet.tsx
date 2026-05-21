import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Product, ProductColor } from "../../../types";
import { api } from "../../../services/api";
import { useCartStore } from "../../../store/useCartStore";
import {
  getDiscountPercent,
  getEffectivePrice,
  getPrimaryImage,
} from "../../../utils/product";
import { getVariantCssBackground } from "../../../utils/variantColor";
import {
  useVerticalProductSelection,
  formatSizeLabel,
} from "../../../commerce/useVerticalProductSelection";
import { formatOrderLineSummary } from "@repo-shared/businessCommerce";
import { useStorefrontPayload } from "../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsFields } from "../../../commerce/VerticalOrderOptionsFields";
import {
  cartLineIdentityKey,
  storageColorForCart,
} from "../../../commerce/cartLineIdentity";
import type { SchemaObject } from "../../admin/DynamicFieldRenderer";
import { recordRecentlyViewed } from "../discovery/recentlyViewed";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import "./ProductDetailSheet.css";

export type ProductDetailSheetProps = {
  product: Product;
  businessId: number;
  businessType?: string;
  featuredProducts: Product[];
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  showToast?: (msg: string) => void;
};

function mergeProductsUnique(a: Product[], b: Product[]): Product[] {
  const m = new Map<number, Product>();
  for (const p of [...a, ...b]) {
    const id = p.id;
    if (typeof id === "number" && id > 0) m.set(id, p);
  }
  return [...m.values()];
}

export function ProductDetailSheet({
  product,
  businessId,
  businessType,
  featuredProducts,
  catalogProducts,
  onClose,
  onSelectProduct,
  showToast,
}: ProductDetailSheetProps): ReactElement | null {
  const toast = showToast ?? (() => undefined);
  const [resolved, setResolved] = useState<Product | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const display =
    resolved != null && resolved.id === product.id ? resolved : product;

  useEffect(() => {
    setResolved(null);
    setCurrentIndex(0);
    const id = product.id;
    if (!Number.isFinite(id) || !id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<Product>(`/products/${id}`);
        if (!cancelled && res.data?.id === id) setResolved(res.data);
      } catch {
        if (!cancelled) setResolved(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  useBodyScrollLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { payload } = useStorefrontPayload();
  const resolvedBusinessType =
    businessType ?? display.businessType ?? payload?.businessType ?? null;
  const orderOptionsSchema = (payload?.orderOptionsSchema ?? {}) as SchemaObject;

  const [orderOptions, setOrderOptions] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setOrderOptions({});
  }, [product.id]);

  const selection = useVerticalProductSelection(display, resolvedBusinessType);
  const {
    selectedSize,
    selectedColor,
    setSelectedSize,
    setSelectedColor,
    lineColor,
    sizes,
    hasCustomColors,
    outOfStock,
    selectedStock,
    canSelect,
    primaryLabel,
    showColorPicker,
  } = selection;

  const colors: ProductColor[] = useMemo(() => {
    if (!showColorPicker) return [];
    if (display.colors && display.colors.length > 0) return display.colors;
    if (display.variants && display.variants.length > 0) {
      return display.variants.map((v) => ({
        name: v.color,
        hex: getVariantCssBackground(v),
      }));
    }
    return [];
  }, [display, showColorPicker]);

  const variantSummary = formatOrderLineSummary({
    businessType: resolvedBusinessType,
    size: selectedSize,
    color: showColorPicker ? lineColor : null,
    options: orderOptions,
    attributes: display.attributes ?? null,
  });

  const images = useMemo(
    () =>
      display.images && display.images.length > 0
        ? display.images
        : [display.image],
    [display]
  );

  useEffect(() => {
    setCurrentIndex((i) =>
      images.length === 0 ? 0 : Math.min(i, images.length - 1)
    );
  }, [images.length]);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const items = useCartStore((s) => s.items);

  const storageColor = storageColorForCart(resolvedBusinessType, lineColor);

  const cartItem = useMemo(() => {
    if (!selectedSize) return null;
    const probe = {
      productId: display.id!,
      size: selectedSize,
      color: storageColor,
      options: orderOptions,
    };
    const key = cartLineIdentityKey(probe);
    return items.find((i) => cartLineIdentityKey(i) === key) ?? null;
  }, [items, display.id, selectedSize, storageColor, orderOptions]);

  const quantity = cartItem?.quantity ?? 0;

  const discountPct = getDiscountPercent(display);
  const displayPrice = getEffectivePrice(display);

  const canAddToCart =
    canSelect && (!showColorPicker || lineColor !== null);

  const upsertQuantity = useCallback(
    (nextQuantity: number) => {
      if (!selectedSize || outOfStock) return;
      if (showColorPicker && lineColor === null) return;
      if (selectedStock <= 0) return;
      if (cartItem) removeItem(cartItem);
      if (nextQuantity <= 0) return;
      const capped = Math.min(nextQuantity, selectedStock);
      addItem({
        productId: display.id!,
        name: display.name,
        price: displayPrice,
        image: getPrimaryImage(display),
        size: selectedSize,
        color: storageColor,
        options: { ...orderOptions },
        quantity: capped,
      });
    },
    [
      selectedSize,
      outOfStock,
      showColorPicker,
      lineColor,
      selectedStock,
      cartItem,
      removeItem,
      addItem,
      display,
      displayPrice,
      storageColor,
      orderOptions,
    ]
  );

  const handleAdd = () => {
    if (!canAddToCart || lineColor === null) return;
    const line = sizes.find((s) => s.size === selectedSize);
    if (!line || line.stock === 0) return;
    recordRecentlyViewed({ businessId, product: display });
    upsertQuantity(1);
    toast("Добавлено в корзину");
  };

  const related = useMemo(() => {
    const pool = mergeProductsUnique(featuredProducts, catalogProducts);
    const cid = display.categoryId;
    const filtered = pool.filter((p) => p.id !== display.id);
    if (cid != null) {
      const same = filtered.filter((p) => p.categoryId === cid);
      if (same.length > 0) return same.slice(0, 8);
    }
    return filtered.slice(0, 8);
  }, [featuredProducts, catalogProducts, display.id, display.categoryId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40;
    if (dx < -threshold) {
      setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
    } else if (dx > threshold) {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  const handleDragZoneTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleDragZoneTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy > 56) onClose();
  };

  const openSupport = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("sf:openSupport"));
  };

  const host =
    typeof document !== "undefined"
      ? document.getElementById("sf-theme-portal-root") ?? document.body
      : null;

  if (!host) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="pds-back"
        className="sf-pds-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        key="pds-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-pds-title"
        className="sf-pds-panel"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 34, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sf-pds-drag-zone"
          onTouchStart={handleDragZoneTouchStart}
          onTouchEnd={handleDragZoneTouchEnd}
        >
          <div className="sf-pds-handle" aria-hidden />
        </div>
        <div className="sf-pds-scroll">
          <div
            className="sf-pds-gallery"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="sf-pds-gallery-track"
              style={
                images.length > 0
                  ? {
                      width: `${images.length * 100}%`,
                      transform: `translateX(-${(currentIndex * 100) / images.length}%)`,
                    }
                  : undefined
              }
            >
              {images.map((src, i) => (
                <div
                  key={i}
                  className="sf-pds-gallery-slide"
                  style={
                    images.length > 0
                      ? { flex: `0 0 ${100 / images.length}%` }
                      : undefined
                  }
                >
                  <img src={src} alt="" />
                </div>
              ))}
            </div>
          </div>
          {images.length > 1 ? (
            <div className="sf-pds-dots" aria-hidden>
              {images.map((_, i) => (
                <span
                  key={i}
                  className={i === currentIndex ? "active" : ""}
                />
              ))}
            </div>
          ) : null}

          <h2 id="sf-pds-title" className="sf-pds-title">
            {display.name}
          </h2>

          <div className="sf-pds-price-row">
            {discountPct > 0 ? (
              <>
                <span className="sf-pds-price-old">
                  {display.price} сом
                </span>
                <span className="sf-pds-price">{displayPrice} сом</span>
              </>
            ) : (
              <span className="sf-pds-price">{display.price} сом</span>
            )}
          </div>

          {display.description?.trim() ? (
            <p className="sf-pds-desc">{display.description.trim()}</p>
          ) : null}

          {variantSummary ? (
            <p className="sf-pds-desc sf-pds-variant-summary">{variantSummary}</p>
          ) : null}

          {outOfStock ? (
            <p className="sf-pds-desc" role="status">
              Нет в наличии
            </p>
          ) : sizes.length > 0 ? (
            <>
              {showColorPicker && hasCustomColors ? (
                <>
                  <p className="sf-pds-section-label">Цвет</p>
                  <div className="sf-pds-colors">
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
                </>
              ) : null}
              <p className="sf-pds-section-label">{primaryLabel}</p>
              <div className="sf-pds-tiers">
                {sizes.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    disabled={s.stock === 0}
                    className={selectedSize === s.size ? "active" : ""}
                    onClick={() => setSelectedSize(s.size)}
                  >
                    {formatSizeLabel(resolvedBusinessType, s.size)}
                    {s.stock > 0 ? ` · ${s.stock}` : ""}
                  </button>
                ))}
              </div>
              <VerticalOrderOptionsFields
                businessType={resolvedBusinessType}
                schema={orderOptionsSchema}
                value={orderOptions}
                onChange={setOrderOptions}
              />
            </>
          ) : null}

          {related.length > 0 ? (
            <div className="sf-pds-related">
              <p className="sf-pds-section-label">Смотрите также</p>
              <div className="sf-pds-related-scroll">
                {related.map((p) => (
                  <button
                    key={String(p.id)}
                    type="button"
                    className="sf-pds-related-card"
                    onClick={() => onSelectProduct(p)}
                  >
                    <img src={getPrimaryImage(p)} alt="" />
                    <div className="sf-pds-related-meta">
                      <span>{p.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sf-pds-sticky-cta">
          <div className="sf-pds-cta-row">
            {quantity <= 0 ? (
              <button
                type="button"
                className="sf-pds-add"
                disabled={!canAddToCart}
                onClick={handleAdd}
              >
                {outOfStock ? "Нет в наличии" : "В корзину"}
              </button>
            ) : (
              <div className="sf-pds-qty">
                <button
                  type="button"
                  aria-label="Меньше"
                  onClick={() => upsertQuantity(quantity - 1)}
                  disabled={outOfStock || !selectedSize || lineColor === null}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  aria-label="Больше"
                  onClick={() => upsertQuantity(quantity + 1)}
                  disabled={
                    outOfStock ||
                    !selectedSize ||
                    lineColor === null ||
                    quantity >= selectedStock
                  }
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sf-pds-footer">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="sf-pds-footer--primary"
            onClick={openSupport}
          >
            Помощь
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    host
  );
}
