import { useEffect, useState } from "react";
import { useCartStore } from "../store/useCartStore";
import { useLocation } from "react-router-dom";
import { mergeTenantIntoLocation, readShopIdString } from "../utils/storeParams";
import "../components/ui/Cart.css";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { useShop } from "../context/ShopContext";
import { api } from "../services/api";
import type { Product } from "../types";
import { getMaxOrderQty } from "../commerce/quantityPolicy";

type Props = {
  onGoToCheckout: () => void;
};

export default function CartPage({ onGoToCheckout }: Props) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const { businessId } = useShop();
  const { pathname, search } = useLocation();
  const [catalogById, setCatalogById] = useState<Map<number, Product>>(() => new Map());
  const { payload } = useStorefrontPayload();

  useEffect(() => {
    if (businessId == null || !Number.isInteger(businessId) || businessId <= 0) {
      setCatalogById(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<Product[]>("/products");
        if (cancelled) return;
        const m = new Map<number, Product>();
        for (const p of res.data ?? []) {
          if (typeof p.id === "number") m.set(p.id, p);
        }
        setCatalogById(m);
      } catch {
        if (!cancelled) setCatalogById(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const totalPrice = items.reduce((sum, item) => {
    return sum + item.price * (item.quantity ?? 1);
  }, 0);

  const handleGoShop = () => {
    const shop = readShopIdString(pathname, search);
    if (!shop) {
      window.location.href = "/";
      return;
    }
    const nav = mergeTenantIntoLocation({
      pathname: "/",
      rawSearch: search,
      shopIdString: shop,
      storefrontSlug: payload?.storefrontSlug ?? null,
    });
    window.location.href = `${nav.pathname}${nav.search}`;
  };

  const maxQtyForLine = (item: (typeof items)[number]) => {
    const p = catalogById.get(item.productId);
    if (!p) return item.quantity ?? 1;
    return getMaxOrderQty(p, item.size, item.color);
  };

  const handleIncrement = (item: (typeof items)[number]) => {
    const max = maxQtyForLine(item);
    const next = (item.quantity ?? 1) + 1;
    if (next > max) return;
    addItem({
      ...item,
      quantity: next,
    });
  };

  const handleDecrement = (item: (typeof items)[number]) => {
    const nextQuantity = (item.quantity ?? 1) - 1;
    if (nextQuantity <= 0) {
      removeItem(item);
      return;
    }
    addItem({
      ...item,
      quantity: nextQuantity,
    });
  };

  return (
    <div className="cart">
      <h1 className="cart-title">{readTxt("menuCartLabel", "Корзина")}</h1>

      {items.length === 0 && (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <h2>{readTxt("emptyCartTitle", "Корзина пуста").toUpperCase()}</h2>
          <p>{readTxt("emptyCartHint", "Добавьте товары, чтобы оформить заказ")}</p>
          <button className="go-shop" type="button" onClick={handleGoShop}>
            {readTxt("menuShopLabel", "Магазин").toUpperCase()}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="cart-list">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.color}-${item.size}`}
                className="cart-item"
              >
                {item.image ? (
                  <img src={item.image} alt="" />
                ) : (
                  <div className="cart-thumb-fallback" aria-hidden="true" />
                )}

                <div className="cart-content">
                  <div className="cart-top">
                    <h3>{item.name}</h3>
                    <span className="price">
                      {item.price} сом
                    </span>
                  </div>

                  <div className="cart-bottom">
                    <div className="cart-actions">
                      <button
                        type="button"
                        onClick={() => handleDecrement(item)}
                        aria-label="Уменьшить"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleIncrement(item)}
                        aria-label="Увеличить"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-footer">
            <div className="total">
              <span>Итого</span>
              <strong>{totalPrice} сом</strong>
            </div>

            <button
              type="button"
              className="checkout-btn"
              onClick={onGoToCheckout}
            >
              {readTxt("checkoutLabel", "Оформить").toUpperCase()}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
