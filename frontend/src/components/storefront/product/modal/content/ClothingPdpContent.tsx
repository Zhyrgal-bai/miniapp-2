import { useMemo, useState } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { formatSizeLabel } from "../../../../../commerce/useVerticalProductSelection";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import "../../ProductExperienceScreen.css";
import "./ClothingPdpContent.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
};

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatSizeCount(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} размеров`;
  if (n1 === 1) return `${count} размер`;
  if (n1 >= 2 && n1 <= 4) return `${count} размера`;
  return `${count} размеров`;
}

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

export function ClothingPdpContent({
  product,
  businessId,
  businessType,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();
  const [sizeTableOpen, setSizeTableOpen] = useState(false);

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? null;

  const merchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : null;

  const px = useProductExperience({
    product,
    businessId,
    businessType: resolvedBusinessType,
    merchantConfig,
    orderOptionsSchema: (payload?.orderOptionsSchema ?? {}) as Record<string, unknown>,
  });

  const attrs = productAttrs(px.display);
  const heroFacts = useMemo(() => {
    return [
      pickString(attrs, "size"),
      pickString(attrs, "color"),
      px.sizes.length > 0 ? formatSizeCount(px.sizes.length) : null,
    ].filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }, [attrs, px.sizes.length]);

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const sizeGuide =
    typeof merchantConfig?.sizeGuide === "string" && merchantConfig.sizeGuide.trim() !== ""
      ? merchantConfig.sizeGuide.trim()
      : null;

  const clearHint = () => px.clearSelectionHint();

  return (
    <div
      className="px-screen px-screen--telegram px-screen--quick-view px-screen--layout-clothing clothing-pdp"
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="clothing"
    >
      <div className="px-layout">
        <PdpGallery images={px.images} discountPct={px.discountPct} resetKey={product.id} />

        <div className="px-main">
          <header className="px-head">
            <h1 className="px-head__title">{px.display.name}</h1>
            <div className="px-head__price-row">
              <span className="px-head__price">{formatSom(px.displayPrice)} сом</span>
              {px.discountPct > 0 ? (
                <span className="px-head__price-old">{formatSom(px.display.price)} сом</span>
              ) : null}
            </div>
            {heroFacts.length > 0 ? (
              <div className="px-head__facts" role="list" aria-label="Характеристики">
                {heroFacts.map((fact, idx) => (
                  <span key={`${fact}-${idx}`} role="listitem" className="px-head__fact">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
            <p
              className={`px-head__status${px.outOfStock ? " px-head__status--out" : ""}`}
              role="status"
            >
              {stockLabel}
            </p>
            {px.display.description?.trim() ? (
              <p className="px-head__desc">{px.display.description.trim()}</p>
            ) : null}
          </header>

          {!px.outOfStock ? (
            <>
              {px.sizes.length > 0 ? (
                <section className="px-block px-block--size">
                  <h2 className="px-block__label">{px.primaryLabel}</h2>
                  <div className="px-chips">
                    {px.sizes.map((s) => (
                      <button
                        key={s.size}
                        type="button"
                        disabled={s.stock === 0}
                        className={`px-chip${px.selectedSize === s.size ? " is-active" : ""}`}
                        aria-pressed={px.selectedSize === s.size}
                        onClick={() => {
                          px.setSelectedSize(s.size);
                          clearHint();
                        }}
                      >
                        {formatSizeLabel(resolvedBusinessType, s.size)}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {px.showColorPicker && px.hasCustomColors ? (
                <section className="px-block px-block--color">
                  <h2 className="px-block__label">Цвет</h2>
                  <div className="px-chips px-chips--colors">
                    {px.colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        className={`px-chip px-chip--color${px.selectedColor === c.name ? " is-active" : ""}`}
                        aria-label={c.name}
                        aria-pressed={px.selectedColor === c.name}
                        style={{ ["--px-chip-color" as string]: c.hex }}
                        onClick={() => {
                          px.setSelectedColor(c.name);
                          clearHint();
                        }}
                      >
                        <span className="px-chip__swatch" aria-hidden />
                        <span className="px-chip__text">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="px-block px-block--size-table">
                <button
                  type="button"
                  className="clothing-pdp__size-table-toggle"
                  aria-expanded={sizeTableOpen}
                  onClick={() => setSizeTableOpen((v) => !v)}
                >
                  <span>Размерная таблица</span>
                  <span aria-hidden>{sizeTableOpen ? "▲" : "▼"}</span>
                </button>
                {sizeTableOpen ? (
                  <div className="clothing-pdp__size-table-panel">
                    {sizeGuide ? <p>{sizeGuide}</p> : null}
                    {px.display.description?.trim() ? (
                      <p>{px.display.description.trim()}</p>
                    ) : (
                      <p>
                        Сверьте мерки с таблицей производителя в описании товара перед заказом.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="px-block px-block--qty">
                <h2 className="px-block__label">Количество</h2>
                <div className="px-qty" role="group" aria-label="Количество">
                  <button
                    type="button"
                    className="px-qty__btn"
                    aria-label="Меньше"
                    disabled={px.pickQty <= 1}
                    onClick={() => px.setPickQty((q) => Math.max(1, q - 1))}
                  >
                    −
                  </button>
                  <span className="px-qty__value">{px.pickQty}</span>
                  <button
                    type="button"
                    className="px-qty__btn"
                    aria-label="Больше"
                    disabled={!px.selectionReady || px.pickQty >= px.maxPickQty}
                    onClick={() => px.setPickQty((q) => Math.min(px.maxPickQty, q + 1))}
                  >
                    +
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {px.selectionHint ? (
            <p className="px-hint" role="alert">
              {px.selectionHint}
            </p>
          ) : null}
        </div>
      </div>

      <PdpStickyBar
        outOfStock={px.outOfStock}
        addLabel="Добавить в корзину"
        displayPrice={px.displayPrice}
        pickQty={px.pickQty}
        addToCartDisabled={px.addToCartDisabled}
        onAdd={px.handleAddToCart}
        telegramOpenUrl={payload?.telegramOpenUrl ?? null}
      />
    </div>
  );
}
