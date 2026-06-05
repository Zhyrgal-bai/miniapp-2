import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "../store/useCartStore";
import { useLocation } from "react-router-dom";
import { mergeTenantIntoLocation, readShopIdString } from "../utils/storeParams";
import "../components/ui/Cart.css";
import { useStorefrontPayload } from "../components/storefront/runtime/StorefrontPayloadContext";
import { useShop } from "../context/ShopContext";
import { api } from "../services/api";
import type { Product } from "../types";
import { getMaxOrderQty } from "../commerce/quantityPolicy";
import { isOutOfStock } from "../utils/product";
import { formatOrderLineSummary } from "@repo-shared/businessCommerce";
import { cartLineIdentityKey } from "../commerce/cartLineIdentity";
import { EmptyState } from "../components/ui/EmptyState";
import "../components/ui/emptyState.css";
import { CheckoutLoadingSkeleton } from "../components/ui/Skeleton";
import "../components/ui/skeleton.css";

type Props = {
  onGoToCheckout: () => void;
};

function formatSom(n: number): string {
  return `${Math.round(n)} сом`;
}

export default function CartPage({ onGoToCheckout }: Props) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const { businessId } = useShop();
  const { pathname, search } = useLocation();
  const [catalogById, setCatalogById] = useState<Map<number, Product>>(() => new Map());
  const [catalogLoading, setCatalogLoading] = useState(false);
  const { payload } = useStorefrontPayload();

  useEffect(() => {
    if (businessId == null || !Number.isInteger(businessId) || businessId <= 0) {
      setCatalogById(new Map());
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
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
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const businessType = payload?.businessType ?? null;
  const txt = payload?.storefrontTextConfig ?? {};
  const readTxt = (k: string, fb: string) => {
    const v = (txt as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() !== "" ? v : fb;
  };

  const lineTotals = useMemo(
    () =>
      items.map((item) => ({
        item,
        qty: item.quantity ?? 1,
        lineTotal: item.price * (item.quantity ?? 1),
      })),
    [items],
  );

  const totalPrice = lineTotals.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalItems = lineTotals.reduce((sum, row) => sum + row.qty, 0);

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

  const stockIssue = useMemo(() => {
    for (const item of items) {
      const p = catalogById.get(item.productId);
      if (!p) continue;
      if (isOutOfStock(p)) {
        return "Некоторые товары закончились. Удалите их из корзины.";
      }
      const max = getMaxOrderQty(p, item.size, item.color);
      if (max <= 0) {
        return "Некоторые позиции недоступны. Обновите корзину.";
      }
      if ((item.quantity ?? 1) > max) {
        return "Количество превышает остаток на складе.";
      }
    }
    return null;
  }, [items, catalogById]);

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

  if (catalogLoading && items.length > 0) {
    return (
      <div className="cart">
        <h1 className="cart-title">{readTxt("menuCartLabel", "Корзина")}</h1>
        <CheckoutLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="cart">
      <h1 className="cart-title">{readTxt("menuCartLabel", "Корзина")}</h1>

      {items.length === 0 && (
        <EmptyState
          icon="🛒"
          title={readTxt("emptyCartTitle", "Корзина пуста")}
          description={readTxt("emptyCartHint", "Добавьте товары, чтобы оформить заказ")}
          actionLabel={readTxt("menuShopLabel", "В магазин")}
          onAction={handleGoShop}
        />
      )}

      {items.length > 0 && (
        <>
          <div className="cart-list">
            {lineTotals.map(({ item, qty, lineTotal }) => {
              const variantLabel = formatOrderLineSummary({
                businessType,
                size: item.size,
                color: item.color,
                options: item.options,
              });
              const maxQty = maxQtyForLine(item);
              const atMax = qty >= maxQty;
              return (
                <div key={cartLineIdentityKey(item)} className="cart-item">
                  {item.image ? (
                    <img src={item.image} alt="" />
                  ) : (
                    <div className="cart-thumb-fallback" aria-hidden="true" />
                  )}

                  <div className="cart-content">
                    <div className="cart-top">
                      <div className="cart-top__copy">
                        <h3>{item.name}</h3>
                        {variantLabel ? (
                          <p className="cart-variant-label">{variantLabel}</p>
                        ) : null}
                        <p className="cart-unit-price">{formatSom(item.price)} / шт.</p>
                      </div>
                      <button
                        type="button"
                        className="cart-remove-btn"
                        aria-label="Удалить из корзины"
                        onClick={() => removeItem(item)}
                      >
                        🗑
                      </button>
                    </div>

                    <div className="cart-bottom">
                      <div className="cart-actions" role="group" aria-label="Количество">
                        <button
                          type="button"
                          className="cart-actions__btn"
                          onClick={() => handleDecrement(item)}
                          aria-label="Уменьшить"
                        >
                          −
                        </button>
                        <span className="cart-actions__qty">{qty}</span>
                        <button
                          type="button"
                          className="cart-actions__btn"
                          onClick={() => handleIncrement(item)}
                          aria-label="Увеличить"
                          disabled={atMax}
                        >
                          +
                        </button>
                      </div>
                      <strong className="cart-line-total">{formatSom(lineTotal)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-footer">
            {stockIssue ? (
              <p className="cart-stock-warning" role="alert">
                {stockIssue}
              </p>
            ) : null}
            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>Позиций</span>
                <span>{totalItems}</span>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>Итого</span>
                <strong>{formatSom(totalPrice)}</strong>
              </div>
            </div>

            <button
              type="button"
              className="checkout-btn"
              onClick={onGoToCheckout}
              disabled={Boolean(stockIssue)}
            >
              {stockIssue
                ? "Нет в наличии"
                : readTxt("checkoutLabel", "Оформить заказ")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
