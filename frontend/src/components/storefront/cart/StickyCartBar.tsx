import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "../../../store/useCartStore";
import { useStorefrontPayload } from "../runtime/StorefrontPayloadContext";

function formatSom(v: number): string {
  const n = Number(v) || 0;
  return `${n}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  useEffect(() => {
    if (qty > prevQty.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 260);
      return () => window.clearTimeout(t);
    }
    prevQty.current = qty;
  }, [qty]);

  if (!props.visible || qty <= 0) return null;

  return (
    <div className={`sf-sticky-cart${bump ? " sf-sticky-cart--bump" : ""}`} role="region" aria-label="Корзина">
      <button type="button" className="sf-sticky-cart__main" onClick={props.onOpenCart}>
        <div className="sf-sticky-cart__title">{readTxt("menuCartLabel", "Корзина")}</div>
        <div className="sf-sticky-cart__meta">
          <span className="sf-sticky-cart__qty">{qty} шт.</span>
          <span className="sf-sticky-cart__sum">{formatSom(total)} сом</span>
        </div>
      </button>
      <button type="button" className="sf-sticky-cart__cta" onClick={props.onCheckout}>
        {readTxt("checkoutLabel", "Оформить")}
      </button>
    </div>
  );
}

