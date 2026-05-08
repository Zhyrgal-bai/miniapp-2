import type React from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { THEME_PRESETS } from "./themePresets";

export function ThemeEditor(props: {
  theme: ResolvedStoreTheme;
  onPatch: (patch: Record<string, unknown>) => void;
}): React.ReactElement {
  const t = props.theme;
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Theme</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {THEME_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              props.onPatch({
                ...(p.colors ?? {}),
                tokens: p.tokens,
              })
            }
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.03)",
              color: "#fff",
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Apply preset"
          >
            {p.title}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Primary
          <input
            defaultValue={t.primaryColor}
            onBlur={(e) => props.onPatch({ primaryColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Background
          <input
            defaultValue={t.bgColor}
            onBlur={(e) => props.onPatch({ bgColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Text
          <input
            defaultValue={t.textColor}
            onBlur={(e) => props.onPatch({ textColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Card
          <input
            defaultValue={t.cardColor}
            onBlur={(e) => props.onPatch({ cardColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
      </div>
    </div>
  );
}

