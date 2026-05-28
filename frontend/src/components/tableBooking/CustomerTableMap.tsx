import type { CustomerDiningTableDto } from "../../services/tableBookingApi";

type Props = {
  tables: CustomerDiningTableDto[];
  selectedId: number | null;
  onSelect: (table: CustomerDiningTableDto) => void;
};

export function CustomerTableMap({ tables, selectedId, onSelect }: Props) {
  const statusClass = (status: string) =>
    `table-map-chip--status-${status.toLowerCase()}`;

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
