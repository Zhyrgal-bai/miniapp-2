import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsExperience } from "../../../vertical/VerticalOrderOptionsExperience";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import type { SchemaObject } from "../../../../admin/DynamicFieldRenderer";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pxScreenClasses } from "../../pdp/pxScreenClasses";
import "../../ProductExperienceScreen.css";
import "./FlowersPdpContent.css";

type Props = {
  product: Product;
  businessId: number;
  businessType?: string;
  catalogProducts: Product[];
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  pageLayout?: boolean;
};

function formatSom(v: number): string {
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

const PACKAGING_RU: Record<string, string> = {
  paper: "Бумага",
  box: "Коробка",
};

export function FlowersPdpContent({
  product,
  businessId,
  businessType,
  pageLayout = false,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();
  const orderOptionsSchema = (payload?.orderOptionsSchema ?? {}) as SchemaObject;

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
    const packaging = pickString(attrs, "packaging");
    return [
      pickString(attrs, "deliveryDate"),
      pickString(attrs, "bouquetCount"),
      packaging ? (PACKAGING_RU[packaging] ?? packaging) : null,
    ].filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }, [attrs]);

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  return (
    <div
      className={pxScreenClasses({
        pageLayout,
        layoutId: "flowers",
        pdpClass: "flowers-pdp",
      })}
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="flowers"
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
            <p className="flowers-pdp__notice">
              Добавьте открытку и пожелание в блоке опций заказа перед добавлением в корзину.
            </p>
          </header>

          {!px.outOfStock ? (
            <>
              <div className="flowers-pdp__options">
                <VerticalOrderOptionsExperience
                  businessType={resolvedBusinessType}
                  merchantConfig={merchantConfig}
                  schema={orderOptionsSchema}
                  value={px.orderOptions}
                  onChange={px.setOrderOptions}
                />
              </div>

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
        addLabel="Отправить подарок"
        displayPrice={px.displayPrice}
        pickQty={px.pickQty}
        addToCartDisabled={px.addToCartDisabled}
        onAdd={px.handleAddToCart}
        telegramOpenUrl={payload?.telegramOpenUrl ?? null}
      />
    </div>
  );
}
