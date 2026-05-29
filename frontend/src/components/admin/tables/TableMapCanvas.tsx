import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DiningTableDto } from "../../../services/diningTablesApi";
import { clamp01, snapLayoutCoord } from "./tableMapUtils";

type DragKind = "move" | "resize";

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
  const chipRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragRef = useRef<{
    kind: DragKind;
    tableId: number;
    startClientX: number;
    startClientY: number;
    origin: DiningTableDto;
  } | null>(null);

  const readNorm = useCallback((clientX: number, clientY: number) => {
    const el = shellRef.current;
    if (!el) return { x: 0, y: 0, w: 1, h: 1 };
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { x: 0, y: 0, w: 1, h: 1 };
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
      w: r.width,
      h: r.height,
    };
  }, []);

  const resetChipStyles = useCallback((tableId: number, kind: DragKind) => {
    const chip = chipRefs.current.get(tableId);
    if (!chip) return;
    chip.style.transform = "";
    if (kind === "resize") {
      chip.style.width = "";
      chip.style.height = "";
    }
  }, []);

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    const chip = chipRefs.current.get(drag.tableId);
    const shell = shellRef.current;
    if (!chip || !shell) return;

    const o = drag.origin;
    let patch: Partial<DiningTableDto> = {};

    if (drag.kind === "move") {
      const tr = chip.style.transform;
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(tr);
      const dxPx = match ? Number(match[1]) : 0;
      const dyPx = match ? Number(match[2]) : 0;
      const { w, h } = readNorm(drag.startClientX, drag.startClientY);
      patch = {
        posX: snapLayoutCoord(clamp01(Math.min(o.posX + dxPx / w, 1 - o.width))),
        posY: snapLayoutCoord(clamp01(Math.min(o.posY + dyPx / h, 1 - o.height))),
      };
    } else {
      const wStr = chip.style.width;
      const hStr = chip.style.height;
      const width =
        wStr.endsWith("%") ? clamp01(Number.parseFloat(wStr) / 100) : o.width;
      const height =
        hStr.endsWith("%") ? clamp01(Number.parseFloat(hStr) / 100) : o.height;
      patch = {
        width: snapLayoutCoord(Math.max(0.08, width)),
        height: snapLayoutCoord(Math.max(0.08, height)),
      };
    }

    resetChipStyles(drag.tableId, drag.kind);
    onPatchTable(drag.tableId, patch);
  }, [onPatchTable, readNorm, resetChipStyles]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || mode !== "editor") return;
      e.preventDefault();

      const chip = chipRefs.current.get(drag.tableId);
      if (!chip) return;

      const dxPx = e.clientX - drag.startClientX;
      const dyPx = e.clientY - drag.startClientY;
      const o = drag.origin;

      if (drag.kind === "move") {
        chip.style.transform = `translate(${dxPx}px, ${dyPx}px)`;
      } else {
        const start = readNorm(drag.startClientX, drag.startClientY);
        const dxNorm = (e.clientX - drag.startClientX) / start.w;
        const dyNorm = (e.clientY - drag.startClientY) / start.h;
        chip.style.width = `${clamp01(Math.max(0.08, Math.min(0.92, o.width + dxNorm))) * 100}%`;
        chip.style.height = `${clamp01(Math.max(0.08, Math.min(0.92, o.height + dyNorm))) * 100}%`;
      }
    },
    [mode, readNorm],
  );

  const endDrag = useCallback(() => {
    if (dragRef.current) {
      commitDrag();
    }
    dragRef.current = null;
    setDraggingId(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [commitDrag, onPointerMove]);

  useEffect(() => () => endDrag(), [endDrag]);

  const startDrag = (
    e: ReactPointerEvent,
    table: DiningTableDto,
    kind: DragKind,
  ) => {
    if (mode !== "editor") return;
    e.stopPropagation();
    e.preventDefault();

    const chip = (e.currentTarget as HTMLElement).closest(".table-map-chip");
    if (!(chip instanceof HTMLElement)) return;

    onSelect(table.id);
    setDraggingId(table.id);

    dragRef.current = {
      kind,
      tableId: table.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origin: { ...table },
    };

    if (typeof chip.setPointerCapture === "function") {
      try {
        chip.setPointerCapture(e.pointerId);
      } catch {
        /* window listeners handle move */
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  const orderedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const rank = (id: number) => {
        if (id === draggingId) return 2;
        if (id === selectedId) return 1;
        return 0;
      };
      return rank(a.id) - rank(b.id);
    });
  }, [tables, draggingId, selectedId]);

  const statusClass = (status: string) =>
    `table-map-chip--status-${status.toLowerCase()}`;

  return (
    <div
      ref={shellRef}
      className={`table-map-shell${mode === "preview" ? " table-map-shell--preview" : ""}${mode === "editor" ? " table-map-shell--editor" : ""}`}
      onPointerDown={(e) => {
        if (mode !== "editor") return;
        if (e.target === shellRef.current) onSelect(null);
      }}
      role="presentation"
    >
      <div className="table-map-grid" aria-hidden />
      {mode === "editor" ? (
        <p className="table-map-editor-hint">
          Тяните стол — двигается сразу. Отпустите — прилипнет к сетке. Угол — размер.
        </p>
      ) : null}
      {orderedTables.map((table) => {
        const selected = selectedId === table.id;
        const dragging = draggingId === table.id;
        return (
          <div
            key={table.id}
            ref={(el) => {
              if (el) chipRefs.current.set(table.id, el);
              else chipRefs.current.delete(table.id);
            }}
            className={[
              "table-map-chip",
              `table-map-chip--shape-${table.shape.toLowerCase()}`,
              statusClass(table.status),
              selected ? "is-selected" : "",
              dragging ? "is-dragging" : "",
              mode === "editor" ? "table-map-chip--editable" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${table.posX * 100}%`,
              top: `${table.posY * 100}%`,
              width: `${table.width * 100}%`,
              height: `${table.height * 100}%`,
            }}
            onPointerDown={(e) => {
              if (mode !== "editor") return;
              if ((e.target as HTMLElement).closest(".table-map-resize")) return;
              startDrag(e, table, "move");
            }}
          >
            <span className="table-map-chip__name">{table.name}</span>
            <span className="table-map-chip__seats">{table.seats} мест</span>
            {mode === "editor" ? (
              <span
                className={`table-map-resize${selected || dragging ? " is-active" : ""}`}
                role="presentation"
                aria-label="Изменить размер"
                onPointerDown={(e) => startDrag(e, table, "resize")}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
