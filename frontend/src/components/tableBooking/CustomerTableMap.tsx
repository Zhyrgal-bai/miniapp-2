import type { CustomerDiningTableDto } from "../../services/tableBookingApi";
import "../venue/liveFloor.css";

type Props = {
  tables: CustomerDiningTableDto[];
  selectedId: number | null;
  onSelect: (table: CustomerDiningTableDto) => void;
};

/** Map live + legacy dining statuses to CSS modifiers. */
function statusClass(status: string): string {
  const s = status.toUpperCase();
  const liveMap: Record<string, string> = {
    FREE: "live-free",
    RESERVED: "live-reserved",
    ARRIVED: "live-arrived",
    ORDERING: "live-ordering",
    EATING: "live-eating",
    PAYMENT: "live-payment",
    CLEANING: "live-cleaning",
    AVAILABLE: "live-free",
    SOON_OCCUPIED: "live-reserved",
    OCCUPIED: "live-eating",
  };
  const key = liveMap[s];
  if (key) return `table-map-chip--${key}`;
  return `table-map-chip--status-${status.toLowerCase()}`;
}

export function CustomerTableMap({ tables, selectedId, onSelect }: Props) {
  return (
    <div className="table-map-shell table-map-shell--booking" role="presentation">
      <div className="table-map-grid" aria-hidden />
      {tables.map((table) => {
        const selected = selectedId === table.id;
        const disabled = !table.bookable;
        return (
          <button
            key={table.id}
            type="button"
            disabled={disabled}
            className={[
              "table-map-chip",
              "table-map-chip--booking",
              `table-map-chip--shape-${table.shape.toLowerCase()}`,
              statusClass(table.status),
              selected ? "is-selected" : "",
              disabled ? "is-disabled" : "",
              table.bookable ? "is-bookable" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${table.posX * 100}%`,
              top: `${table.posY * 100}%`,
              width: `${table.width * 100}%`,
              height: `${table.height * 100}%`,
            }}
            onClick={() => {
              if (!disabled) onSelect(table);
            }}
          >
            <span className="table-map-chip__name">{table.name}</span>
            <span className="table-map-chip__seats">{table.seats} мест</span>
            {table.shape === "VIP" ? (
              <span className="table-map-chip__vip">VIP</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
