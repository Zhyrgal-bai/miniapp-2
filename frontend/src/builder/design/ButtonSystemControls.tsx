import React from "react";

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readNumber(obj: unknown, key: string, fallback: number): number {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readBool(obj: unknown, key: string, fallback: boolean): boolean {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : fallback;
}

export type StorefrontButtonsConfig = {
  radius: number;
  height: number;
  shadow: boolean;
  glow: boolean;
  variant: "filled" | "outline";
  compact: boolean;
  animationLevel: "off" | "low" | "high";
};

export function ButtonSystemControls(props: {
  value: unknown;
  onChange: (next: StorefrontButtonsConfig) => void;
}): React.ReactElement {
  const v: StorefrontButtonsConfig = {
    radius: readNumber(props.value, "radius", 14),
    height: readNumber(props.value, "height", 44),
    shadow: readBool(props.value, "shadow", true),
    glow: readBool(props.value, "glow", false),
    variant: readString(props.value, "variant", "filled") === "outline" ? "outline" : "filled",
    compact: readBool(props.value, "compact", false),
    animationLevel:
      readString(props.value, "animationLevel", "low") === "off" ||
      readString(props.value, "animationLevel", "low") === "high"
        ? (readString(props.value, "animationLevel", "low") as "off" | "high")
        : "low",
  };

  const patch = (p: Partial<StorefrontButtonsConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Button system</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Variant
          <select value={v.variant} onChange={(e) => patch({ variant: e.target.value as StorefrontButtonsConfig["variant"] })} style={inputStyle}>
            <option value="filled">Filled</option>
            <option value="outline">Outline</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Animation
          <select
            value={v.animationLevel}
            onChange={(e) => patch({ animationLevel: e.target.value as StorefrontButtonsConfig["animationLevel"] })}
            style={inputStyle}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Radius: {v.radius}px
          <input type="range" min={0} max={32} value={Math.min(32, Math.max(0, v.radius))} onChange={(e) => patch({ radius: Number(e.target.value) })} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Height: {v.height}px
          <input type="range" min={32} max={60} value={Math.min(60, Math.max(32, v.height))} onChange={(e) => patch({ height: Number(e.target.value) })} />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.shadow} onChange={(e) => patch({ shadow: e.target.checked })} />
          Shadow
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.glow} onChange={(e) => patch({ glow: e.target.checked })} />
          Glow
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.compact} onChange={(e) => patch({ compact: e.target.checked })} />
          Compact mode
        </label>
      </div>
    </div>
  );
}

