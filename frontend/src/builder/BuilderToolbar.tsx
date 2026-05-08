import type React from "react";

export function BuilderToolbar(props: {
  saving: boolean;
  onPublish: () => void;
  onReset: () => void;
  canPublish: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky",
        top: 0,
        background: "rgba(11,15,26,0.85)",
        backdropFilter: "blur(10px)",
        zIndex: 5,
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: "0.16em" }}>BUILDER</div>
      <div style={{ opacity: 0.7, fontSize: 12 }}>
        {props.saving ? "Сохранение…" : "Готово"}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={props.onReset}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "transparent",
          color: "rgba(255,255,255,0.85)",
          padding: "8px 12px",
          fontWeight: 700,
        }}
      >
        Reset
      </button>
      <button
        onClick={props.onPublish}
        disabled={!props.canPublish}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(239,68,68,0.45)",
          background: props.canPublish ? "#dc2626" : "rgba(220,38,38,0.35)",
          color: "#fff",
          padding: "8px 12px",
          fontWeight: 800,
          cursor: props.canPublish ? "pointer" : "not-allowed",
        }}
      >
        Publish
      </button>
    </div>
  );
}

