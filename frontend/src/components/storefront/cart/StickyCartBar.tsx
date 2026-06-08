import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "../../../store/useCartStore";
import { useStorefrontPayload } from "../runtime/StorefrontPayloadContext";
import { storefrontShellModeFromStyleConfig } from "../../../storefront/buildStorefrontLayoutCssVars";
import { IconCart } from "../icons/StorefrontCommerceIcons";

function formatSom(v: number): string {
  const n = Number(v) || 0;
  return `${n}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function itemsLabel(qty: number): string {
  const mod10 = qty % 10;
  const mod100 = qty % 100;
  if (mod10 === 1 && mod100 !== 11) return "товар";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "товара";
  return "товаров";
}

export function StickyCartBar(props: {
  visible: boolean;
  onOpenCart: () => void;
  onCheckout: () => void;
}): React.ReactElement | null {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.getTotal());
  const qty = useMemo(() => items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0), [items]);
  const prevQty = useRef<number>(qty);
  const [bump, setBump] = useState(false);
  const { payload } = useStorefrontPayload();
  const shellMode = storefrontShellModeFromStyleConfig(
    (payload?.storefrontStyleConfig ?? null) as Record<string, unknown> | null,
  );
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  useEffect(() => {
    if (qty > prevQty.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 260);
      prevQty.current = qty;
      return () => window.clearTimeout(t);
    }
    prevQty.current = qty;
  }, [qty]);

  if (!props.visible || qty <= 0) return null;

  const checkoutLabel = readTxt("checkoutLabel", "Оформить");

  return (
    <div
      className="sf-chrome-align-commerce sf-sticky-cart-slot"
      data-sf-shell={shellMode}
      role="presentation"
    >
      <button
        type="button"
        className={`sf-sticky-cart sf-sticky-cart--unified${bump ? " sf-sticky-cart--bump" : ""}`}
        aria-label={`Корзина: ${qty} ${itemsLabel(qty)}, ${formatSom(total)} сом`}
        onClick={props.onCheckout}
      >
        <span className="sf-sticky-cart__unified-main">
          <span className="sf-sticky-cart__unified-line">
            <IconCart size={16} className="sf-sticky-cart__icon" />
            {qty} {itemsLabel(qty)}
          </span>
          <span className="sf-sticky-cart__unified-sum">{formatSom(total)} сом</span>
        </span>
        <span className="sf-sticky-cart__unified-cta">{checkoutLabel} ›</span>
      </button>
    </div>
  );
}
