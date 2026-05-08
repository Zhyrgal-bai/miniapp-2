import type React from "react";
import type { PreviewMode } from "./preview/modes";
import { PREVIEW_MODES } from "./preview/modes";

export function PreviewModeSwitcher(props: {
  mode: PreviewMode;
  onChange: (m: PreviewMode) => void;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {PREVIEW_MODES.map((m) => {
        const active = props.mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => props.onChange(m.id)}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: active ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
              color: "#fff",
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

