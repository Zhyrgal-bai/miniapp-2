import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "../../types";
import {
  getDiscountPercent,
  getEffectivePrice,
  getNormalizedVariants,
  getProductImages,
} from "../../utils/product";
import { getVariantCssBackground } from "../../utils/variantColor";
import "./ProductDetailModal.css";

type ProductDetailModalProps = {
  product: Product | null;
  onClose: () => void;
};

export default function ProductDetailModal({
  product,
  onClose,
}: ProductDetailModalProps) {
  const open = product != null;
  const [imgIndex, setImgIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const images = useMemo(
    () => (product ? getProductImages(product) : []),
    [product]
  );

  useEffect(() => {
    setImgIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const variants = useMemo(
    () => (product ? getNormalizedVariants(product) : []),
    [product]
  );

  const discountPct = product ? getDiscountPercent(product) : 0;
  const effective = product ? getEffectivePrice(product) : 0;

  const heroSrc = images[Math.min(imgIndex, Math.max(0, images.length - 1))];
  const hasImages = images.length > 0;

  const goPrevImage = () => {
    if (images.length <= 1) return;
    setImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goNextImage = () => {
    if (images.length <= 1) return;
    setImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="pdm-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdm-title"
            className="pdm-panel"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pdm-close"
              aria-label="Закрыть"
              onClick={onClose}
            >
              ✕
            </button>

            <div className="pdm-gallery">
              {heroSrc ? (
                <>
                  <div
                    className="pdm-gallery-swipe"
                    onTouchStart={(e) => {
                      touchStartXRef.current = e.touches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartXRef.current == null || images.length <= 1) return;
                      const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                      const delta = touchStartXRef.current - endX;
                      if (delta > 50) goNextImage();
                      if (delta < -50) goPrevImage();
                      touchStartXRef.current = null;
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.img
                        key={heroSrc}
                        src={heroSrc}
                        alt={product.name}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </AnimatePresence>
                  </div>
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="pdm-gallery-nav pdm-gallery-nav--left"
                        onClick={goPrevImage}
                        aria-label="Предыдущее фото"
                      >
                        &#x2039;
                      </button>
                      <button
                        type="button"
                        className="pdm-gallery-nav pdm-gallery-nav--right"
                        onClick={goNextImage}
                        aria-label="Следующее фото"
                      >
                        &#x203A;
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="pdm-gallery-placeholder">Нет фото</div>
              )}
            </div>

            {hasImages && (
              <div className="pdm-dots" role="tablist" aria-label="Фото">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`pdm-dot${i === imgIndex ? " pdm-dot--active" : ""}`}
                    aria-label={`Фото ${i + 1}`}
                    aria-selected={i === imgIndex}
                    onClick={() => setImgIndex(i)}
                  />
                ))}
              </div>
            )}

            {product.category ? (
              <span className="pdm-badge">
                {product.category.parent?.name
                  ? `${product.category.parent.name} / ${product.category.name}`
                  : product.category.name}
              </span>
            ) : null}

            <h2 id="pdm-title" className="pdm-title">
              {product.name}
            </h2>

            <div className="pdm-prices">
              {discountPct > 0 ? (
                <>
                  <span className="pdm-price-old" aria-label="Без скидки">
                    {product.price}{" "}
                    <span className="pdm-price-currency">сом</span>
                  </span>
                  <span className="pdm-price">
                    {effective}{" "}
                    <span className="pdm-price-currency">сом</span>
                  </span>
                </>
              ) : (
                <span className="pdm-price">
                  {product.price}{" "}
                  <span className="pdm-price-currency">сом</span>
                </span>
              )}
            </div>

            <p
              className={`pdm-desc${product.description?.trim() ? "" : " pdm-desc--empty"}`}
            >
              {product.description?.trim()
                ? product.description
                : "Описание отсутствует"}
            </p>

            {variants.length > 0 && (
              <>
                <h3 className="pdm-section-title">Варианты</h3>
                {variants.map((v, i) => (
                  <div key={v.id ?? `v-${i}-${v.color}`} className="pdm-variant">
                    <div className="pdm-variant-color">
                      <span
                        className="pdm-variant-swatch"
                        style={{ background: getVariantCssBackground(v) }}
                        title={v.color}
                        aria-hidden
                      />
                      <span>{v.color}</span>
                    </div>
                    <div className="pdm-sizes">
                      {v.sizes?.length ? (
                        v.sizes.map((s) => (
                          <span key={s.size} className="pdm-size-chip">
                            {s.size} · {s.stock} шт.
                          </span>
                        ))
                      ) : (
                        <span className="pdm-size-chip pdm-size-chip--empty">
                          нет размеров
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
