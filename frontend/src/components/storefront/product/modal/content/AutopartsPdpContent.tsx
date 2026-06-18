import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsExperience } from "../../../vertical/VerticalOrderOptionsExperience";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import type { SchemaObject } from "../../../../admin/DynamicFieldRenderer";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pxScreenClasses } from "../../pdp/pxScreenClasses";
import { pickString, productAttrs } from "../../shared/productAttrs";
import "../../ProductExperienceScreen.css";
import "./AutopartsPdpContent.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  pageLayout?: boolean;
};

const FITMENT_FIELDS = [
  { key: "oem", label: "OEM номер", mono: true },
  { key: "compatibleModels", label: "Совместимые модели" },
  { key: "modelYear", label: "Год автомобиля" },
  { key: "engine", label: "Двигатель" },
] as const;

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function AutopartsPdpContent({
  product,
  businessId,
  businessType,
  pageLayout = false,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();
  const orderOptionsSchema = (payload?.orderOptionsSchema ?? {}) as SchemaObject;

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? "autoparts";

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
  const brand = pickString(attrs, "brand");
  const sku = pickString(attrs, "sku");

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const fitmentRows = useMemo(() => {
    return FITMENT_FIELDS.flatMap((field) => {
      let value = pickString(attrs, field.key);
      if (field.key === "compatibleModels" && !value) {
        value = pickString(attrs, "compatibility");
      }
      if (!value) return [];
      return [
        {
          key: field.key,
          label: field.label,
          value,
          mono: "mono" in field ? field.mono : false,
        },
      ];
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

  const hasOrderOptions = Object.keys(orderOptionsSchema).length > 0;

  return (
    <div
      className={pxScreenClasses({
        pageLayout,
        layoutId: "autoparts",
        pdpClass: "autoparts-pdp",
      })}
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="autoparts"
    >
      <div className="px-layout">
        <PdpGallery images={px.images} discountPct={px.discountPct} resetKey={product.id} />

        <div className="px-main">
          <header className="px-head">
            <h1 className="px-head__title">{px.display.name}</h1>
            {(brand || sku) && (
              <div className="px-head__facts" role="list" aria-label="Артикул и бренд">
                {brand ? (
                  <span role="listitem" className="px-head__fact">
                    {brand}
                  </span>
                ) : null}
                {sku ? (
                  <span role="listitem" className="px-head__fact">
                    {sku}
                  </span>
                ) : null}
              </div>
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
              {fitmentRows.length > 0 ? (
                <section className="px-block px-block--fitment">
                  <h2 className="px-block__label">Подбор и совместимость</h2>
                  <ul className="autoparts-pdp__fitment">
                    {fitmentRows.map((row) => (
                      <li key={row.key} className="autoparts-pdp__fitment-row">
                        <span className="autoparts-pdp__fitment-label">{row.label}</span>
                        <span
                          className={`autoparts-pdp__fitment-value${row.mono ? " autoparts-pdp__fitment-value--mono" : ""}`}
                        >
                          {row.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="px-block px-block--fitment-note">
                <div className="autoparts-pdp__notice">
                  Перед заказом сверьте OEM и совместимость с вашим автомобилем. При сомнениях
                  укажите VIN — продавец проверит подбор.
                </div>
              </section>

              {hasOrderOptions ? (
                <section className="px-block px-block--order-options">
                  <VerticalOrderOptionsExperience
                    businessType={resolvedBusinessType}
                    schema={orderOptionsSchema}
                    value={px.orderOptions}
                    onChange={px.setOrderOptions}
                  />
                </section>
              ) : null}

              <section className="px-block px-block--delivery">
                <h2 className="px-block__label">Доставка</h2>
                <div className="autoparts-pdp__delivery-grid">
                  {deliveryLines.map((line) => (
                    <div key={line.title} className="autoparts-pdp__delivery-row">
                      <div className="autoparts-pdp__delivery-title">{line.title}</div>
                      <div className="autoparts-pdp__delivery-value">{line.value}</div>
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
        addLabel="Добавить к заказу"
        displayPrice={px.displayPrice}
        pickQty={px.pickQty}
        addToCartDisabled={px.addToCartDisabled}
        onAdd={px.handleAddToCart}
        telegramOpenUrl={payload?.telegramOpenUrl ?? null}
      />
    </div>
  );
}
