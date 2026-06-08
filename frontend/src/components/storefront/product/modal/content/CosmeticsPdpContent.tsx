import { useMemo } from "react";
import type { Product } from "../../../../../types";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { SKIN_TYPE_RU } from "@repo-shared/businessCommerce";
import { formatEtaRange } from "@repo-shared/storeAvailabilitySettings";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import { useProductExperience } from "../../useProductExperience";
import { PdpGallery } from "../../pdp/PdpGallery";
import { PdpStickyBar } from "../../pdp/PdpStickyBar";
import { pickString, productAttrs } from "../../shared/productAttrs";
import "../../ProductExperienceScreen.css";
import "./CosmeticsPdpContent.css";

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

function resolveSkinTypeLabel(raw: string | null): string | null {
  if (!raw) return null;
  return SKIN_TYPE_RU[raw] ?? raw;
}

export function CosmeticsPdpContent({
  product,
  businessId,
  businessType,
}: Props): React.ReactElement {
  const { payload } = useStorefrontPayload();
  const commerceEnabled = isStorefrontCommerceEnabled();

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? "cosmetics";

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
  });

  const attrs = productAttrs(px.display);
  const brand = pickString(attrs, "brand");
  const shade = pickString(attrs, "shade");
  const volume = pickString(attrs, "volume");
  const skinType = resolveSkinTypeLabel(pickString(attrs, "skinType"));
  const ingredients = pickString(attrs, "ingredients");
  const usageGuide = pickString(attrs, "usageGuide");

  const stockLabel = useMemo(() => {
    if (px.outOfStock) return "Нет в наличии";
    if (px.selectedStock > 0 && px.selectedStock <= 3) {
      return `Осталось ${px.selectedStock}`;
    }
    return "В наличии";
  }, [px.outOfStock, px.selectedStock]);

  const factChips = useMemo(() => {
    const items: Array<{ key: string; label: string; shade?: boolean }> = [];
    if (shade) items.push({ key: "shade", label: shade, shade: true });
    if (volume) items.push({ key: "volume", label: volume });
    if (skinType) items.push({ key: "skinType", label: skinType });
    return items;
  }, [shade, volume, skinType]);

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

  return (
    <div
      className="px-screen px-screen--telegram px-screen--quick-view px-screen--layout-cosmetics cosmetics-pdp"
      data-px-commerce={commerceEnabled ? "telegram" : "web"}
      data-sf-vertical="cosmetics"
    >
      <div className="px-layout">
        <PdpGallery images={px.images} discountPct={px.discountPct} />

        <div className="px-main">
          <header className="px-head">
            <h1 className="px-head__title">{px.display.name}</h1>
            {brand ? <p className="px-head__desc">{brand}</p> : null}
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
              {factChips.length > 0 ? (
                <section className="px-block px-block--cosmetics-facts">
                  <h2 className="px-block__label">Параметры</h2>
                  <div className="cosmetics-pdp__facts" role="list">
                    {factChips.map((chip) => (
                      <span
                        key={chip.key}
                        role="listitem"
                        className={`cosmetics-pdp__fact${chip.shade ? " cosmetics-pdp__fact--shade" : ""}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {ingredients ? (
                <section className="px-block px-block--ingredients">
                  <h2 className="px-block__label">Состав</h2>
                  <div className="cosmetics-pdp__text-panel">
                    <p>{ingredients}</p>
                  </div>
                </section>
              ) : null}

              {usageGuide ? (
                <section className="px-block px-block--usage">
                  <h2 className="px-block__label">Способ применения</h2>
                  <div className="cosmetics-pdp__text-panel">
                    <p>{usageGuide}</p>
                  </div>
                </section>
              ) : null}

              <section className="px-block px-block--delivery">
                <h2 className="px-block__label">Доставка</h2>
                <div className="cosmetics-pdp__delivery-grid">
                  {deliveryLines.map((line) => (
                    <div key={line.title} className="cosmetics-pdp__delivery-row">
                      <div className="cosmetics-pdp__delivery-title">{line.title}</div>
                      <div className="cosmetics-pdp__delivery-value">{line.value}</div>
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
