import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  discountPct: number;
  resetKey?: string | number | null;
};

export function PdpGallery({
  images,
  discountPct,
  resetKey = null,
}: Props): React.ReactElement {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setGalleryIndex(0);
  }, [images, resetKey]);

  useEffect(() => {
    setGalleryIndex((i) => (images.length === 0 ? 0 : Math.min(i, images.length - 1)));
  }, [images.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || images.length <= 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (dx < -40) {
        setGalleryIndex((i) => Math.min(i + 1, images.length - 1));
      } else if (dx > 40) {
        setGalleryIndex((i) => Math.max(i - 1, 0));
      }
      touchStartX.current = null;
    },
    [images.length],
  );

  const handleTouchCancel = useCallback(() => {
    touchStartX.current = null;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (images.length <= 1) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setGalleryIndex((i) => Math.min(i + 1, images.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setGalleryIndex((i) => Math.max(i - 1, 0));
      }
    },
    [images.length],
  );

  return (
    <section
      className="px-gallery"
      aria-label="Фото товара"
      tabIndex={images.length > 1 ? 0 : -1}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onKeyDown={handleKeyDown}
    >
      {images.length > 0 ? (
        <div
          className="px-gallery__track"
          style={{
            width: `${images.length * 100}%`,
            transform: `translateX(-${(galleryIndex * 100) / images.length}%)`,
          }}
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="px-gallery__slide"
              style={{ flex: `0 0 ${100 / images.length}%` }}
            >
              <img src={src} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-gallery__placeholder" aria-hidden>
          <span className="px-gallery__placeholder-icon">📷</span>
          <span className="px-gallery__placeholder-text">Нет фото</span>
        </div>
      )}
      {images.length > 1 ? (
        <div className="px-gallery__dots" role="tablist" aria-label="Фото товара">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === galleryIndex}
              aria-label={`Фото ${i + 1} из ${images.length}`}
              className={`px-gallery__dot${i === galleryIndex ? " is-active" : ""}`}
              onClick={() => setGalleryIndex(i)}
            />
          ))}
        </div>
      ) : null}
      {discountPct > 0 ? (
        <span className="px-gallery__badge">−{discountPct}%</span>
      ) : null}
    </section>
  );
}
