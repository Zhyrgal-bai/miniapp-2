import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DiningTableDto } from "../../../services/diningTablesApi";
import { clamp01 } from "./tableMapUtils";

type DragKind = "move" | "resize" | null;

type Props = {
  tables: DiningTableDto[];
  mode: "editor" | "preview";
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onPatchTable: (id: number, patch: Partial<DiningTableDto>) => void;
};

export function TableMapCanvas({
  tables,
  mode,
  selectedId,
  onSelect,
  onPatchTable,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: DragKind;
    tableId: number;
    startX: number;
    startY: number;
    origin: DiningTableDto;
  } | null>(null);

  const readNorm = useCallback((clientX: number, clientY: number) => {
    const el = shellRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    };
  }, []);

  const patchTable = useCallback(
    (id: number, patch: Partial<DiningTableDto>) => {
      onPatchTable(id, patch);
    },
    [onPatchTable],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || mode !== "editor") return;
      const { x, y } = readNorm(e.clientX, e.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const o = drag.origin;

      if (drag.kind === "move") {
        const w = o.width;
        const h = o.height;
        patchTable(drag.tableId, {
          posX: clamp01(Math.min(o.posX + dx, 1 - w)),
          posY: clamp01(Math.min(o.posY + dy, 1 - h)),
        });
      } else if (drag.kind === "resize") {
        patchTable(drag.tableId, {
          width: clamp01(Math.max(0.08, o.width + dx)),
          height: clamp01(Math.max(0.08, o.height + dy)),
        });
      }
    },
    [mode, patchTable, readNorm],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  useEffect(() => () => endDrag(), [endDrag]);

  const startDrag = (
    e: ReactPointerEvent,
    table: DiningTableDto,
    kind: Exclude<DragKind, null>,
  ) => {
    if (mode !== "editor") return;
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = readNorm(e.clientX, e.clientY);
    dragRef.current = {
      kind,
      tableId: table.id,
      startX: x,
      startY: y,
      origin: { ...table },
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  const statusClass = (status: string) =>
    `table-map-chip--status-${status.toLowerCase()}`;

  return (
    <div
      ref={shellRef}
      className={`table-map-shell${mode === "preview" ? " table-map-shell--preview" : ""}`}
      onPointerDown={() => mode === "editor" && onSelect(null)}
      role="presentation"
    >
      <div className="table-map-grid" aria-hidden />
      {tables.map((table) => {
        const selected = selectedId === table.id;
        return (
          <div
            key={table.id}
            className={[
              "table-map-chip",
              `table-map-chip--shape-${table.shape.toLowerCase()}`,
              statusClass(table.status),
              selected ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${table.posX * 100}%`,
              top: `${table.posY * 100}%`,
              width: `${table.width * 100}%`,
              height: `${table.height * 100}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === "editor") onSelect(table.id);
            }}
            onPointerDown={(e) => {
              if (mode !== "editor") return;
              if ((e.target as HTMLElement).classList.contains("table-map-resize")) return;
              e.stopPropagation();
              startDrag(e, table, "move");
            }}
          >
            <span className="table-map-chip__name">{table.name}</span>
            <span className="table-map-chip__seats">{table.seats} мест</span>
            {mode === "editor" && selected ? (
              <span
                className="table-map-resize"
                role="presentation"
                onPointerDown={(e) => startDrag(e, table, "resize")}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
