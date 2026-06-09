import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pickString, productAttrs } from "../../shared/productAttrs";
import "../../ProductExperienceScreen.css";
import "./FurniturePdpContent.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
};

const SPEC_FIELDS = [
  { key: "dimensions", label: "Габариты" },
  { key: "material", label: "Материал" },
  { key: "colorFamily", label: "Цвет", fallbackKey: "color" },
] as const;

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function pickBoolean(attrs: Record<string, unknown>, key: string): boolean | null {
  const value = attrs[key];
  return typeof value === "boolean" ? value : null;
}

export function FurniturePdpContent({
  product,
  businessId,
  businessType,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? "furniture";

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
  const dimensions = pickString(attrs, "dimensions");
  const material = pickString(attrs, "material");
  const assemblyRequired = pickBoolean(attrs, "assemblyRequired");
  const warranty = pickString(attrs, "warranty");

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const specRows = useMemo(() => {
    return SPEC_FIELDS.flatMap((field) => {
      let value = pickString(attrs, field.key);
      if (!value && "fallbackKey" in field && field.fallbackKey) {
        value = pickString(attrs, field.fallbackKey);
      }
      if (!value) return [];
      return [{ key: field.key, label: field.label, value }];
    });
  }, [attrs]);

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

  const assemblyLabel = useMemo(() => {
    if (assemblyRequired === true) return "Требуется сборка";
    if (assemblyRequired === false) return "Поставляется в собранном виде";
    return null;
  }, [assemblyRequired]);

  return (
    <div
      className="px-screen px-screen--telegram px-screen--quick-view px-screen--layout-furniture furniture-pdp"
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="furniture"
    >
      <div className="px-layout">
        <PdpGallery images={px.images} discountPct={px.discountPct} resetKey={product.id} />

        <div className="px-main">
          <header className="px-head">
            <h1 className="px-head__title">{px.display.name}</h1>
            {(dimensions || material) && (
              <p className="px-head__desc">
                {[dimensions, material].filter(Boolean).join(" • ")}
              </p>
            )}
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
              {specRows.length > 0 ? (
                <section className="px-block px-block--furniture-specs">
                  <h2 className="px-block__label">Характеристики</h2>
                  <ul className="furniture-pdp__specs">
                    {specRows.map((row) => (
                      <li key={row.key} className="furniture-pdp__spec-row">
                        <span className="furniture-pdp__spec-label">{row.label}</span>
                        <span className="furniture-pdp__spec-value">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {assemblyLabel ? (
                <section className="px-block px-block--assembly">
                  <h2 className="px-block__label">Сборка</h2>
                  <div
                    className={`furniture-pdp__assembly${assemblyRequired === true ? " furniture-pdp__assembly--required" : ""}`}
                  >
                    <p>{assemblyLabel}</p>
                    {assemblyRequired === true ? (
                      <p className="furniture-pdp__assembly-hint">
                        Уточните условия доставки и сборки у продавца перед оформлением.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {warranty ? (
                <section className="px-block px-block--warranty">
                  <h2 className="px-block__label">Гарантия</h2>
                  <div className="furniture-pdp__warranty">
                    <p>{warranty}</p>
                  </div>
                </section>
              ) : null}

              <section className="px-block px-block--delivery">
                <h2 className="px-block__label">Доставка</h2>
                <div className="furniture-pdp__delivery-grid">
                  {deliveryLines.map((line) => (
                    <div key={line.title} className="furniture-pdp__delivery-row">
                      <div className="furniture-pdp__delivery-title">{line.title}</div>
                      <div className="furniture-pdp__delivery-value">{line.value}</div>
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
