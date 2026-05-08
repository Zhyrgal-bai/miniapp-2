import React, { useMemo } from "react";
import { useCartStore } from "../../../store/useCartStore";

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

  if (!props.visible || qty <= 0) return null;

  return (
    <div className="sf-sticky-cart" role="region" aria-label="Корзина">
      <button type="button" className="sf-sticky-cart__main" onClick={props.onOpenCart}>
        <div className="sf-sticky-cart__title">Корзина</div>
        <div className="sf-sticky-cart__meta">
          <span className="sf-sticky-cart__qty">{qty} шт.</span>
          <span className="sf-sticky-cart__sum">{formatSom(total)} сом</span>
        </div>
      </button>
      <button type="button" className="sf-sticky-cart__cta" onClick={props.onCheckout}>
        Оформить
      </button>
    </div>
  );
}

