import { useCartStore } from "../store/useCartStore";
import "../components/ui/Cart.css";

type Props = {
  onGoToCheckout: () => void;
};

export default function CartPage({ onGoToCheckout }: Props) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);

  const totalPrice = items.reduce((sum, item) => {
    return sum + item.price * (item.quantity ?? 1);
  }, 0);

  const handleGoShop = () => {
    window.location.href = "/";
  };

  const handleIncrement = (item: (typeof items)[number]) => {
    removeItem(item);
    addItem({
      ...item,
      quantity: (item.quantity ?? 1) + 1,
    });
  };

  const handleDecrement = (item: (typeof items)[number]) => {
    const nextQuantity = (item.quantity ?? 1) - 1;
    removeItem(item);
    if (nextQuantity <= 0) return;
    addItem({
      ...item,
      quantity: nextQuantity,
    });
  };

  return (
    <div className="cart">
      <h1 className="cart-title">Корзина</h1>

      {items.length === 0 && (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <h2>КОРЗИНА ПУСТА</h2>
          <p>Добавьте товары, чтобы оформить заказ</p>
          <button className="go-shop" type="button" onClick={handleGoShop}>
            СМОТРЕТЬ ТОВАРЫ
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
              ОФОРМИТЬ ЗАКАЗ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
