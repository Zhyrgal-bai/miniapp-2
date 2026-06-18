import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { formatSizeLabel } from "../../../../../commerce/useVerticalProductSelection";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pxScreenClasses } from "../../pdp/pxScreenClasses";
import { pickString, productAttrs } from "../../shared/productAttrs";
import "../../ProductExperienceScreen.css";
import "./ElectronicsPdpContent.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  pageLayout?: boolean;
};

const SPEC_FIELDS = [
  { key: "display", label: "Дисплей" },
  { key: "cpu", label: "Процессор" },
  { key: "ram", label: "ОЗУ" },
  { key: "storage", label: "Накопитель" },
  { key: "battery", label: "Батарея" },
  { key: "warranty", label: "Гарантия" },
] as const;

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function ElectronicsPdpContent({
  product,
  businessId,
  businessType,
  pageLayout = false,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? "electronics";

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

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const specRows = useMemo(() => {
    return SPEC_FIELDS.flatMap(({ key, label }) => {
      const value = pickString(attrs, key);
      return value ? [{ key, label, value }] : [];
    });
  }, [attrs]);

  const kitContents = pickString(attrs, "kitContents");
  const warrantyText = pickString(attrs, "warranty");

  const availability = payload?.storeAvailability;
  const deliveryLines = useMemo(() => {
    const lines: Array<{ title: string; value: string }> = [];
    if (availability?.deliveryEnabled) {
      lines.push({
        title: "Доставка",
        value: formatEtaRange(availability.deliveryEta ?? payload?.deliveryEta),
      });
    }
    if (availability?.pickupEnabled) {
      lines.push({
        title: "Самовывоз",
        value: formatEtaRange(availability.pickupEta ?? payload?.pickupEta),
      });
    }
    if (lines.length === 0) {
      lines.push({
        title: "Доставка",
        value: "Уточните условия у продавца",
      });
    }
    return lines;
  }, [availability, payload?.deliveryEta, payload?.pickupEta]);

  const clearHint = () => px.clearSelectionHint();

  return (
    <div
      className={pxScreenClasses({
        pageLayout,
        layoutId: "electronics",
        pdpClass: "electronics-pdp",
      })}
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="electronics"
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
            <p
              className={`px-head__status${px.outOfStock ? " px-head__status--out" : ""}`}
              role="status"
            >
              {stockLabel}
            </p>
          </header>

          {!px.outOfStock ? (
            <>
              {px.sizes.length > 0 ? (
                <section className="px-block px-block--memory">
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

              {specRows.length > 0 ? (
                <section className="px-block px-block--specs">
                  <h2 className="px-block__label">Характеристики</h2>
                  <ul className="electronics-pdp__specs">
                    {specRows.map((row) => (
                      <li key={row.key} className="electronics-pdp__spec-row">
                        <span className="electronics-pdp__spec-label">{row.label}</span>
                        <span className="electronics-pdp__spec-value">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {kitContents ? (
                <section className="px-block px-block--kit">
                  <h2 className="px-block__label">Комплектация</h2>
                  <div className="electronics-pdp__info-panel">
                    <p>{kitContents}</p>
                  </div>
                </section>
              ) : null}

              {warrantyText ? (
                <section className="px-block px-block--warranty">
                  <h2 className="px-block__label">Гарантия</h2>
                  <div className="electronics-pdp__info-panel">
                    <p>{warrantyText}</p>
                  </div>
                </section>
              ) : null}

              <section className="px-block px-block--delivery">
                <h2 className="px-block__label">Доставка</h2>
                <div className="electronics-pdp__delivery-grid">
                  {deliveryLines.map((line) => (
                    <div key={line.title} className="electronics-pdp__delivery-row">
                      <div>
                        <div className="electronics-pdp__delivery-title">{line.title}</div>
                        <div className="electronics-pdp__delivery-value">{line.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
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
