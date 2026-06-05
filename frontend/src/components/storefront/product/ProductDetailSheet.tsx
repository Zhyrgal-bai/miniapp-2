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
import { useStorefrontPayload } from "../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsFields } from "../../../commerce/VerticalOrderOptionsFields";
import {
  cartLineIdentityKey,
  storageColorForCart,
} from "../../../commerce/cartLineIdentity";
import type { SchemaObject } from "../../admin/DynamicFieldRenderer";
import { recordRecentlyViewed } from "../discovery/recentlyViewed";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import { isStorefrontCommerceEnabled } from "../../../hooks/useStorefrontCommerceMode";
import { openOpenInTelegramModal } from "../../../storefront/openInTelegramModal";
import { trackAddToCart } from "../../../services/storefrontAnalytics";
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
  const [pickQty, setPickQty] = useState(1);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const display =
    resolved != null && resolved.id === product.id ? resolved : product;

  useEffect(() => {
    setResolved(null);
    setCurrentIndex(0);
    setPickQty(1);
    setSelectionHint(null);
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
  const addLabel =
    typeof payload?.storefrontTextConfig?.addToCartLabel === "string" &&
    String(payload.storefrontTextConfig.addToCartLabel).trim() !== ""
      ? String(payload.storefrontTextConfig.addToCartLabel)
      : "Добавить в корзину";

  const [orderOptions, setOrderOptions] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setOrderOptions({});
    setPickQty(1);
    setSelectionHint(null);
  }, [product.id]);

  const selection = useVerticalProductSelection(display, resolvedBusinessType, {
    autoSelectDefaults: false,
  });
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

  const images = useMemo(
    () =>
      display.images && display.images.length > 0
        ? display.images
        : [display.image],
    [display],
  );

  useEffect(() => {
    setCurrentIndex((i) =>
      images.length === 0 ? 0 : Math.min(i, images.length - 1),
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

  const cartQuantity = cartItem?.quantity ?? 0;

  const discountPct = getDiscountPercent(display);
  const displayPrice = getEffectivePrice(display);

  const selectionReady =
    !outOfStock &&
    selectedSize != null &&
    selectedStock > 0 &&
    (!showColorPicker || !hasCustomColors || selectedColor != null);

  const upsertQuantity = useCallback(
    (nextQuantity: number) => {
      if (!selectedSize || outOfStock) return;
      if (showColorPicker && hasCustomColors && selectedColor == null) return;
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
      if (businessId && display.id) trackAddToCart(businessId, display.id);
    },
    [
      selectedSize,
      outOfStock,
      showColorPicker,
      hasCustomColors,
      selectedColor,
      selectedStock,
      cartItem,
      removeItem,
      addItem,
      display,
      displayPrice,
      storageColor,
      orderOptions,
      businessId,
    ],
  );

  const validateSelection = (): boolean => {
    if (outOfStock) return false;
    if (showColorPicker && hasCustomColors && selectedColor == null) {
      setSelectionHint("Выберите цвет");
      return false;
    }
    if (selectedSize == null) {
      setSelectionHint(`Выберите ${primaryLabel.toLowerCase()}`);
      return false;
    }
    if (selectedStock <= 0) {
      setSelectionHint("Нет в наличии для выбранного варианта");
      return false;
    }
    setSelectionHint(null);
    return true;
  };

  const handleAddToCart = () => {
    if (!validateSelection()) return;
    recordRecentlyViewed({ businessId, product: display });
    const next = cartQuantity > 0 ? cartQuantity + pickQty : pickQty;
    upsertQuantity(Math.min(next, selectedStock));
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

  const host =
    typeof document !== "undefined"
      ? (document.getElementById("sf-theme-portal-root") ?? document.body)
      : null;

  if (!host) return null;

  const maxPickQty = selectionReady ? Math.max(1, selectedStock - cartQuantity) : 1;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="pdp-screen"
        className="pdp-screen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdp-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      >
        <header className="pdp-topbar">
          <button type="button" className="pdp-topbar__back" onClick={onClose} aria-label="Назад">
            ←
          </button>
          <span className="pdp-topbar__title">Товар</span>
          <span className="pdp-topbar__spacer" aria-hidden />
        </header>

        <div className="pdp-scroll">
          <div
            className="pdp-gallery"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="pdp-gallery__track"
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
                  className="pdp-gallery__slide"
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
            {images.length > 1 ? (
              <div className="pdp-gallery__dots" aria-hidden>
                {images.map((_, i) => (
                  <span key={i} className={i === currentIndex ? "is-active" : ""} />
                ))}
              </div>
            ) : null}
            {discountPct > 0 ? (
              <span className="pdp-gallery__badge">−{discountPct}%</span>
            ) : null}
          </div>

          <div className="pdp-body">
            <h1 id="pdp-title" className="pdp-name">
              {display.name}
            </h1>

            <div className="pdp-price-block">
              <span className="pdp-price">{displayPrice} сом</span>
              {discountPct > 0 ? (
                <span className="pdp-price-old">{display.price} сом</span>
              ) : null}
            </div>

            {display.description?.trim() ? (
              <p className="pdp-desc">{display.description.trim()}</p>
            ) : null}

            {outOfStock ? (
              <p className="pdp-stock pdp-stock--out" role="status">
                Нет в наличии
              </p>
            ) : (
              <>
                {showColorPicker && hasCustomColors ? (
                  <section className="pdp-section">
                    <h2 className="pdp-section__label">Цвет</h2>
                    <div className="pdp-colors">
                      {colors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className={`pdp-color${selectedColor === c.name ? " is-active" : ""}`}
                          aria-label={c.name}
                          aria-pressed={selectedColor === c.name}
                          style={{ background: c.hex }}
                          onClick={() => {
                            setSelectedColor(c.name);
                            setSelectionHint(null);
                          }}
                        >
                          <span className="pdp-color__name">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {sizes.length > 0 ? (
                  <section className="pdp-section">
                    <h2 className="pdp-section__label">{primaryLabel}</h2>
                    <div className="pdp-sizes">
                      {sizes.map((s) => (
                        <button
                          key={s.size}
                          type="button"
                          disabled={s.stock === 0}
                          className={`pdp-size${selectedSize === s.size ? " is-active" : ""}`}
                          aria-pressed={selectedSize === s.size}
                          onClick={() => {
                            setSelectedSize(s.size);
                            setSelectionHint(null);
                          }}
                        >
                          {formatSizeLabel(resolvedBusinessType, s.size)}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <VerticalOrderOptionsFields
                  businessType={resolvedBusinessType}
                  schema={orderOptionsSchema}
                  value={orderOptions}
                  onChange={setOrderOptions}
                />

                <section className="pdp-section">
                  <h2 className="pdp-section__label">Количество</h2>
                  <div className="pdp-qty" role="group" aria-label="Количество">
                    <button
                      type="button"
                      className="pdp-qty__btn"
                      aria-label="Меньше"
                      disabled={pickQty <= 1}
                      onClick={() => setPickQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <span className="pdp-qty__value">{pickQty}</span>
                    <button
                      type="button"
                      className="pdp-qty__btn"
                      aria-label="Больше"
                      disabled={!selectionReady || pickQty >= maxPickQty}
                      onClick={() => setPickQty((q) => Math.min(maxPickQty, q + 1))}
                    >
                      +
                    </button>
                  </div>
                </section>
              </>
            )}

            {selectionHint ? (
              <p className="pdp-hint" role="alert">
                {selectionHint}
              </p>
            ) : null}

            {related.length > 0 ? (
              <section className="pdp-section pdp-section--related">
                <h2 className="pdp-section__label">Похожие товары</h2>
                <div className="pdp-related">
                  {related.map((p) => (
                    <button
                      key={String(p.id)}
                      type="button"
                      className="pdp-related__card"
                      onClick={() => onSelectProduct(p)}
                    >
                      <img src={getPrimaryImage(p)} alt="" />
                      <span>{p.name}</span>
                      <strong>{getEffectivePrice(p)} сом</strong>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <footer className="pdp-sticky-bar">
          <div className="pdp-sticky-bar__price">
            <span className="pdp-sticky-bar__label">Итого</span>
            <strong>{displayPrice * (cartQuantity > 0 ? cartQuantity : pickQty)} сом</strong>
          </div>
          {!isStorefrontCommerceEnabled() ? (
            <button
              type="button"
              className="pdp-sticky-bar__cta"
              onClick={() => openOpenInTelegramModal(payload?.telegramOpenUrl ?? null)}
            >
              {outOfStock ? "Нет в наличии" : addLabel}
            </button>
          ) : cartQuantity > 0 ? (
            <div className="pdp-sticky-bar__cart-qty" role="group" aria-label="В корзине">
              <button
                type="button"
                className="pdp-qty__btn"
                aria-label="Уменьшить"
                onClick={() => upsertQuantity(cartQuantity - 1)}
              >
                −
              </button>
              <span className="pdp-qty__value">{cartQuantity}</span>
              <button
                type="button"
                className="pdp-qty__btn"
                aria-label="Увеличить"
                disabled={cartQuantity >= selectedStock || !selectionReady}
                onClick={() => upsertQuantity(cartQuantity + 1)}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pdp-sticky-bar__cta"
              disabled={outOfStock}
              onClick={handleAddToCart}
            >
              {outOfStock ? "Нет в наличии" : addLabel}
            </button>
          )}
        </footer>
      </motion.div>
    </AnimatePresence>,
    host,
  );
}
