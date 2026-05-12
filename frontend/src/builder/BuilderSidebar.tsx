import type React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableRow(props: {
  id: string;
  active: boolean;
  enabled: boolean;
  titleLeft: string;
  subtitle: string;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveAsBlock: () => void;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          background: props.active
            ? "rgba(220,38,38,0.22)"
            : "rgba(255,255,255,0.03)",
          cursor: "pointer",
        }}
        onClick={props.onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 26,
            height: 26,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.85)",
            cursor: "grab",
            fontWeight: 900,
            lineHeight: "24px",
            padding: 0,
          }}
          aria-label="Drag"
          title="Drag"
        >
          ⠿
        </button>
        <div style={{ fontWeight: 800, minWidth: 90 }}>{props.titleLeft}</div>
        <div style={{ opacity: 0.7, fontSize: 12, flex: 1 }}>{props.subtitle}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onDuplicate();
          }}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.85)",
            padding: "6px 10px",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}
          title="Duplicate"
        >
          ⧉
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete();
          }}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.30)",
            background: "rgba(239,68,68,0.10)",
            color: "rgba(255,255,255,0.9)",
            padding: "6px 10px",
            fontWeight: 900,
            fontSize: 12,
            cursor: "pointer",
          }}
          title="Delete"
        >
          🗑
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onSaveAsBlock();
          }}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.85)",
            padding: "6px 10px",
            fontWeight: 900,
            fontSize: 12,
            cursor: "pointer",
          }}
          title="Save as block"
        >
          ⬇
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle();
          }}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: props.enabled
              ? "rgba(99,102,241,0.16)"
              : "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.9)",
            padding: "6px 10px",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {props.enabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

export function BuilderSidebar(props: {
  sections: Array<{ id: string; type: string; enabled?: boolean; order?: number }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onAddSection: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveAsBlock: (id: string) => void;
  uxWarnings: string[];
  uxErrors: string[];
}): React.ReactElement {
  const ids = props.sections.map((s) => s.id);
  return (
    <div
      style={{
        width: 320,
        maxWidth: "92vw",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(15,23,42,0.55)",
      }}
    >
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>Секции</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={props.onAddSection}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(220,38,38,0.18)",
              color: "#fff",
              padding: "8px 10px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            + Добавить
          </button>
        </div>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(ev) => {
            const { active, over } = ev;
            if (!over || active.id === over.id) return;
            const oldIndex = ids.indexOf(String(active.id));
            const newIndex = ids.indexOf(String(over.id));
            if (oldIndex < 0 || newIndex < 0) return;
            const next = arrayMove(ids, oldIndex, newIndex);
            props.onReorder(next);
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {props.sections.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.85)",
                  textAlign: "center",
                }}
              >
                У вас пока нет секций. Нажмите “+ Добавить”.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {props.sections.map((s) => {
                  const active = props.selectedId === s.id;
                  const enabled = s.enabled !== false;
                  return (
                    <SortableRow
                      key={s.id}
                      id={s.id}
                      active={active}
                      enabled={enabled}
                      titleLeft={s.type}
                      subtitle={s.id}
                      onSelect={() => props.onSelect(s.id)}
                      onToggle={() => props.onToggle(s.id)}
                      onDuplicate={() => props.onDuplicate(s.id)}
                      onDelete={() => props.onDelete(s.id)}
                    onSaveAsBlock={() => props.onSaveAsBlock(s.id)}
                    />
                  );
                })}
              </div>
            )}
          </SortableContext>
        </DndContext>

        {(props.uxErrors.length > 0 || props.uxWarnings.length > 0) && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>UX</div>
            {props.uxErrors.map((m, idx) => (
              <div
                key={`e-${idx}`}
                style={{ color: "#fca5a5", fontSize: 12, marginBottom: 4 }}
              >
                {m}
              </div>
            ))}
            {props.uxWarnings.map((m, idx) => (
              <div
                key={`w-${idx}`}
                style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 }}
              >
                {m}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

