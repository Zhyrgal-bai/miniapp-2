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
    moved: boolean;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<{ id: number; patch: Partial<DiningTableDto> } | null>(
    null,
  );

  const readNorm = useCallback((clientX: number, clientY: number) => {
    const el = shellRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    };
  }, []);

  const flushPatch = useCallback(() => {
    rafRef.current = null;
    const pending = pendingPatchRef.current;
    if (!pending) return;
    pendingPatchRef.current = null;
    onPatchTable(pending.id, pending.patch);
  }, [onPatchTable]);

  const schedulePatch = useCallback(
    (id: number, patch: Partial<DiningTableDto>) => {
      pendingPatchRef.current = { id, patch };
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(flushPatch);
    },
    [flushPatch],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || mode !== "editor") return;
      e.preventDefault();

      const { x, y } = readNorm(e.clientX, e.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) {
        drag.moved = true;
      }
      const o = drag.origin;

      if (drag.kind === "move") {
        const w = o.width;
        const h = o.height;
        schedulePatch(drag.tableId, {
          posX: clamp01(Math.min(o.posX + dx, 1 - w)),
          posY: clamp01(Math.min(o.posY + dy, 1 - h)),
        });
      } else if (drag.kind === "resize") {
        schedulePatch(drag.tableId, {
          width: clamp01(Math.max(0.08, Math.min(0.92, o.width + dx))),
          height: clamp01(Math.max(0.08, Math.min(0.92, o.height + dy))),
        });
      }
    },
    [mode, readNorm, schedulePatch],
  );

  const endDrag = useCallback(() => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPatch();
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [flushPatch, onPointerMove]);

  useEffect(() => () => endDrag(), [endDrag]);

  const capturePointer = (e: ReactPointerEvent, chip: HTMLElement) => {
    if (typeof chip.setPointerCapture === "function") {
      try {
        chip.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — window listeners still work */
      }
    }
  };

  const startDrag = (
    e: ReactPointerEvent,
    table: DiningTableDto,
    kind: Exclude<DragKind, null>,
  ) => {
    if (mode !== "editor") return;
    e.stopPropagation();
    e.preventDefault();

    const chip = (e.currentTarget as HTMLElement).closest(".table-map-chip");
    if (!(chip instanceof HTMLElement)) return;

    onSelect(table.id);

    const { x, y } = readNorm(e.clientX, e.clientY);
    dragRef.current = {
      kind,
      tableId: table.id,
      startX: x,
      startY: y,
      origin: { ...table },
      moved: false,
    };
    capturePointer(e, chip);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

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
          Тяните стол для перемещения. Угол справа снизу — размер.
        </p>
      ) : null}
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
                className={`table-map-resize${selected ? " is-active" : ""}`}
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
