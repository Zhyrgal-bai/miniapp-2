import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useShop } from "../../context/ShopContext";
import { ORDER_PREP_STATUS_LABELS, type OrderPrepStatus } from "@repo-shared/venueOperations";
import {
  fetchVenueKitchen,
  venueSetPrep,
  type KitchenOrderRow,
  type KitchenPreorderRow,
} from "../../services/venueApi";
import { useVenueLiveStream } from "../../hooks/useVenueLiveStream";
import { formatAdminApiError } from "../../utils/adminApiError";
import "./adminKitchen.css";

const COLS: { prep: OrderPrepStatus; title: string }[] = [
  { prep: "PREPARING", title: "Готовится" },
  { prep: "READY", title: "Готово" },
  { prep: "SERVED", title: "Выдано" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PreorderCard(props: {
  order: KitchenPreorderRow;
  onAdvance: (orderId: number, next: OrderPrepStatus) => void;
}) {
  const { order, onAdvance } = props;
  return (
    <li className="kitchen-preorders__card">
      <p className="kitchen-preorders__head">
        {order.customerName}
        {order.reservation?.tableName ? ` · ${order.reservation.tableName}` : ""}
      </p>
      {order.reservation?.reservedAt ? (
        <p className="kitchen-preorders__when">
          Бронь: {formatTime(order.reservation.reservedAt)}
          {order.reservation.partySize != null
            ? ` · ${order.reservation.partySize} гостей`
            : ""}
        </p>
      ) : null}
      {order.startsInLabel ? (
        <p className="kitchen-preorders__starts">Запуск: {order.startsInLabel}</p>
      ) : null}
      <ul className="kitchen-preorders__items">
        {order.items.map((it, idx) => (
          <li key={`${order.id}-${idx}`}>
            {it.name} × {it.quantity}
          </li>
        ))}
      </ul>
      <p className="kitchen-preorders__total">
        {ORDER_PREP_STATUS_LABELS[order.prepStatus as OrderPrepStatus]} · {order.total} сом
      </p>
      {order.prepStatus === "READY_FOR_PREP" ? (
        <button type="button" onClick={() => onAdvance(order.id, "PREPARING")}>
          Начать готовку
        </button>
      ) : null}
      {order.prepStatus === "PREPARING" ? (
        <button type="button" onClick={() => onAdvance(order.id, "READY")}>
          Готово
        </button>
      ) : null}
      {order.prepStatus === "READY" ? (
        <button type="button" onClick={() => onAdvance(order.id, "SERVED")}>
          Выдано
        </button>
      ) : null}
    </li>
  );
}

export default function AdminKitchenPage(): ReactElement {
  const { businessId } = useShop();
  const [orders, setOrders] = useState<KitchenOrderRow[]>([]);
  const [scheduled, setScheduled] = useState<KitchenPreorderRow[]>([]);
  const [activePreorders, setActivePreorders] = useState<KitchenPreorderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (businessId == null) return;
    try {
      const data = await fetchVenueKitchen(businessId);
      setOrders(data.orders);
      setScheduled(data.preordersScheduled ?? []);
      setActivePreorders(data.preordersActive ?? data.preorders ?? []);
      setError(null);
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useVenueLiveStream(businessId, load);

  const advance = async (orderId: number, next: OrderPrepStatus) => {
    if (businessId == null) return;
    try {
      await venueSetPrep(businessId, orderId, next);
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

      <section className="kitchen-preorders kitchen-preorders--now">
        <h2 className="kitchen-preorders__title">
          🔥 Готовить сейчас
          <span className="kitchen-board__count">{activePreorders.length}</span>
        </h2>
        {activePreorders.length === 0 ? (
          <p className="admin-dash-page__muted">Нет предзаказов в работе.</p>
        ) : (
          <ul className="kitchen-preorders__list">
            {activePreorders.map((o) => (
              <PreorderCard key={o.id} order={o} onAdvance={(id, next) => void advance(id, next)} />
            ))}
          </ul>
        )}
      </section>

      <section className="kitchen-preorders kitchen-preorders--scheduled">
        <h2 className="kitchen-preorders__title">
          ⏳ Запланировано
          <span className="kitchen-board__count">{scheduled.length}</span>
        </h2>
        {scheduled.length === 0 ? (
          <p className="admin-dash-page__muted">Нет запланированных предзаказов.</p>
        ) : (
          <ul className="kitchen-preorders__list">
            {scheduled.map((o) => (
              <PreorderCard key={o.id} order={o} onAdvance={(id, next) => void advance(id, next)} />
            ))}
          </ul>
        )}
      </section>

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
                      <button type="button" onClick={() => void advance(o.id, "READY")}>
                        Готово
                      </button>
                    ) : null}
                    {col.prep === "READY" ? (
                      <button type="button" onClick={() => void advance(o.id, "SERVED")}>
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
