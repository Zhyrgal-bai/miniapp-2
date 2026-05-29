import type { FloorTableDto } from "../../services/venueApi";
import { TABLE_LIVE_STATUS_LABELS, type TableLiveStatus } from "@repo-shared/venueOperations";
import "../../pages/admin/adminTables.css";
import "./liveFloor.css";

type Props = {
  tables: FloorTableDto[];
  selectedId: number | null;
  onSelect: (table: FloorTableDto) => void;
};

function statusClass(status: string): string {
  return `table-map-chip--live-${status.toLowerCase()}`;
}

export function LiveFloorMap({ tables, selectedId, onSelect }: Props) {
  return (
    <div className="table-map-shell table-map-shell--live" role="presentation">
      <div className="table-map-grid" aria-hidden />
      {tables.map((table) => {
        const selected = selectedId === table.id;
        const mins = table.session?.seatedMinutes ?? 0;
        const pulse =
          table.liveStatus === "EATING" ||
          table.liveStatus === "ORDERING" ||
          table.liveStatus === "PAYMENT";
        return (
          <button
            key={table.id}
            type="button"
            className={[
              "table-map-chip",
              "table-map-chip--live",
              `table-map-chip--shape-${table.shape.toLowerCase()}`,
              statusClass(table.liveStatus),
              selected ? "is-selected" : "",
              pulse ? "is-pulse" : "",
              table.liveStatus === "PAYMENT" ? "is-payment" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${table.posX * 100}%`,
              top: `${table.posY * 100}%`,
              width: `${table.width * 100}%`,
              height: `${table.height * 100}%`,
            }}
            onClick={() => onSelect(table)}
          >
            <span className="table-map-chip__name">{table.name}</span>
            <span className="table-map-chip__seats">{table.seats} мест</span>
            <span className="table-map-chip__live-label">
              {TABLE_LIVE_STATUS_LABELS[table.liveStatus as TableLiveStatus] ?? table.liveStatus}
            </span>
            {table.session && mins > 0 ? (
              <span className="table-map-chip__timer">{mins} мин</span>
            ) : null}
            {table.waitlistNext ? (
              <span className="table-map-chip__waitlist">
                {table.waitlistNext.guestName} · {table.waitlistNext.partySize} г.
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
