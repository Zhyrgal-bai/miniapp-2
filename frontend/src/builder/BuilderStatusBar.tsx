import type React from "react";
import type { BuilderSaveState } from "./useBuilderSaveState";

function fmtTime(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function BuilderStatusBar(props: {
  state: BuilderSaveState;
  uxErrorsCount: number;
}): React.ReactElement {
  const s = props.state;
  const text = (() => {
    if (s.isPublishing) return "Publishing…";
    if (s.isSaving) return "Saving…";
    if (s.saveError) return `Ошибка: ${s.saveError}`;
    if (s.isDirty) return "Unsaved changes";
    if (props.uxErrorsCount > 0) return "Fix UX errors before publish";
    if (s.lastSavedAt) return `Saved ${fmtTime(s.lastSavedAt)}`;
    return "Ready";
  })();

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 6,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(11,15,26,0.85)",
        backdropFilter: "blur(10px)",
        color: "rgba(255,255,255,0.88)",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900 }}>{text}</div>
      <div style={{ flex: 1 }} />
      {s.lastPublishedAt ? (
        <div style={{ opacity: 0.7 }}>Published {fmtTime(s.lastPublishedAt)}</div>
      ) : null}
    </div>
  );
}

