import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import { ORDER_PREP_STATUS_LABELS, type OrderPrepStatus } from "@repo-shared/venueOperations";
import { fetchVenueKitchen, venueSetPrep, type KitchenOrderRow } from "../../services/venueApi";
import { useVenueLiveStream } from "../../hooks/useVenueLiveStream";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./adminKitchen.css";

const COLS: { prep: OrderPrepStatus; title: string }[] = [
  { prep: "PREPARING", title: "Готовится" },
  { prep: "READY", title: "Готово" },
  { prep: "SERVED", title: "Выдано" },
];

export default function AdminKitchenPage(): ReactElement {
  const { businessId } = useShop();
  const [orders, setOrders] = useState<KitchenOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (businessId == null) return;
    try {
      const data = await fetchVenueKitchen(businessId);
      setOrders(data.orders);
      setError(null);
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useVenueLiveStream(businessId, load);

  const advance = async (order: KitchenOrderRow, next: OrderPrepStatus) => {
    if (businessId == null) return;
    try {
      await venueSetPrep(businessId, order.id, next);
      await load();
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  };

  return (
    <div className="admin-dash-page kitchen-board-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">👨‍🍳 Kitchen Board</h1>
        <p className="admin-dash-page__subtitle">Заказы в работе</p>
      </header>

      <div className="kitchen-board">
        {COLS.map((col) => {
          const list = orders.filter((o) => o.prepStatus === col.prep);
          return (
            <section key={col.prep} className="kitchen-board__col">
              <h2 className="kitchen-board__col-title">
                {col.title}
                <span className="kitchen-board__count">{list.length}</span>
              </h2>
              <ul className="kitchen-board__list">
                {list.map((o) => (
                  <li key={o.id} className="kitchen-board__card">
                    <p className="kitchen-board__order">
                      #{o.orderNumber ?? o.id}
                      {o.tableSession?.table?.name
                        ? ` · ${o.tableSession.table.name}`
                        : ""}
                    </p>
                    <p className="kitchen-board__meta">
                      {ORDER_PREP_STATUS_LABELS[o.prepStatus as OrderPrepStatus]} · {o.total} сом
                    </p>
                    {col.prep === "PREPARING" ? (
                      <button type="button" onClick={() => void advance(o, "READY")}>
                        Готово
                      </button>
                    ) : null}
                    {col.prep === "READY" ? (
                      <button type="button" onClick={() => void advance(o, "SERVED")}>
                        Выдано
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {error ? (
        <div className="admin-dash-card admin-dash-page__alert" role="alert">
          <p style={{ margin: 0, color: "#fecaca" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
