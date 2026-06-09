import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { VerticalOrderOptionsExperience } from "../../../vertical/VerticalOrderOptionsExperience";
import { formatSizeLabel } from "../../../../../commerce/useVerticalProductSelection";
import { SPICY_RU } from "@repo-shared/businessCommerce";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import type { SchemaObject } from "../../../../admin/DynamicFieldRenderer";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pickNumber, pickString, productAttrs } from "../../shared/productAttrs";
import "../../ProductExperienceScreen.css";
import "./FastfoodPdpContent.css";

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

function resolvePrepTimeLabel(attrs: Record<string, unknown>): string {
  const minutes = pickNumber(attrs, "preparationTimeMinutes");
  if (minutes != null && minutes > 0) return `${minutes} мин`;
  return "15–20 мин";
}

export function FastfoodPdpContent({
  product,
  businessId,
  businessType,
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
    const spicy = pickString(attrs, "spicy");
    const calories = pickNumber(attrs, "calories");
    return [
      resolvePrepTimeLabel(attrs),
      calories != null && calories > 0 ? `${Math.round(calories)} ккал` : null,
      spicy ? (SPICY_RU[spicy] ?? spicy) : null,
    ].filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }, [attrs]);

  const clearHint = () => px.clearSelectionHint();

  return (
    <div
      className="px-screen px-screen--telegram px-screen--quick-view px-screen--layout-fastfood fastfood-pdp"
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="fastfood"
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
              <div className="fastfood-pdp__facts" role="list" aria-label="Информация о блюде">
                {heroFacts.map((fact) => (
                  <span key={fact} role="listitem" className="fastfood-pdp__fact">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
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

              <div className="fastfood-pdp__options">
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
        addLabel="Добавить в заказ"
        displayPrice={px.displayPrice}
        pickQty={px.pickQty}
        addToCartDisabled={px.addToCartDisabled}
        onAdd={px.handleAddToCart}
        telegramOpenUrl={payload?.telegramOpenUrl ?? null}
      />
    </div>
  );
}
