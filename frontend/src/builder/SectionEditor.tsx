import type React from "react";

function tryJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function SectionEditor(props: {
  section: { id: string; type: string; config: Record<string, unknown> } & Record<string, unknown>;
  onChange: (
    next: { id: string; type: string; config: Record<string, unknown> } & Record<string, unknown>,
  ) => void;
}): React.ReactElement {
  const raw = JSON.stringify(props.section?.config ?? {}, null, 2);
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Config</div>
      <textarea
        defaultValue={raw}
        onBlur={(e) => {
          const v = tryJsonParse(e.target.value);
          if (v && typeof v === "object") {
            props.onChange({ ...props.section, config: v as Record<string, unknown> });
          }
        }}
        spellCheck={false}
        style={{
          width: "100%",
          height: 260,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(2,6,23,0.45)",
          color: "rgba(255,255,255,0.9)",
          padding: 10,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
        }}
      />
      <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
        Изменения применяются после ухода с поля (blur). Только валидный JSON.
      </div>
    </div>
  );
}

