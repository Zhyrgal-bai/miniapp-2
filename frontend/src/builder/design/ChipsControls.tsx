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

export type StorefrontChipsConfig = {
  shape: "pill" | "square";
  style: "outline" | "filled";
  size: "sm" | "md" | "lg";
  radius: number;
  gap: number;
};

export function ChipsControls(props: {
  value: unknown;
  onChange: (next: StorefrontChipsConfig) => void;
}): React.ReactElement {
  const v: StorefrontChipsConfig = {
    shape: readString(props.value, "shape", "pill") === "square" ? "square" : "pill",
    style: readString(props.value, "style", "outline") === "filled" ? "filled" : "outline",
    size:
      readString(props.value, "size", "md") === "sm" || readString(props.value, "size", "md") === "lg"
        ? (readString(props.value, "size", "md") as "sm" | "lg")
        : "md",
    radius: readNumber(props.value, "radius", 999),
    gap: readNumber(props.value, "gap", 8),
  };

  const patch = (p: Partial<StorefrontChipsConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Category chips</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Shape
          <select value={v.shape} onChange={(e) => patch({ shape: e.target.value as StorefrontChipsConfig["shape"] })} style={inputStyle}>
            <option value="pill">Pill</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Style
          <select value={v.style} onChange={(e) => patch({ style: e.target.value as StorefrontChipsConfig["style"] })} style={inputStyle}>
            <option value="outline">Outline</option>
            <option value="filled">Filled</option>
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Size
        <select value={v.size} onChange={(e) => patch({ size: e.target.value as StorefrontChipsConfig["size"] })} style={inputStyle}>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Chip radius: {v.radius}px
        <input type="range" min={0} max={32} value={Math.min(32, Math.max(0, v.radius))} onChange={(e) => patch({ radius: Number(e.target.value) })} />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Chip spacing: {v.gap}px
        <input type="range" min={0} max={20} value={Math.min(20, Math.max(0, v.gap))} onChange={(e) => patch({ gap: Number(e.target.value) })} />
      </label>
    </div>
  );
}

