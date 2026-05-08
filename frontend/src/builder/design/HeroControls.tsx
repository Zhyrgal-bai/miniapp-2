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

export type StorefrontHeroConfig = {
  layout: "centered" | "split" | "banner" | "editorial";
  overlay: boolean;
  overlayStrength: number;
  height: number;
  radius: number;
  shadow: boolean;
  alignment: "left" | "center";
  ctaPosition: "below" | "overlay" | "hidden";
};

export function HeroControls(props: { value: unknown; onChange: (next: StorefrontHeroConfig) => void }): React.ReactElement {
  const v: StorefrontHeroConfig = {
    layout: ((): StorefrontHeroConfig["layout"] => {
      const s = readString(props.value, "layout", "centered");
      if (s === "split" || s === "banner" || s === "editorial") return s;
      return "centered";
    })(),
    overlay: readBool(props.value, "overlay", false),
    overlayStrength: Math.max(0, Math.min(1, readNumber(props.value, "overlayStrength", 0.55))),
    height: Math.min(520, Math.max(160, Math.round(readNumber(props.value, "height", 320)))),
    radius: Math.min(40, Math.max(0, Math.round(readNumber(props.value, "radius", 24)))),
    shadow: readBool(props.value, "shadow", false),
    alignment: readString(props.value, "alignment", "center") === "left" ? "left" : "center",
    ctaPosition: ((): StorefrontHeroConfig["ctaPosition"] => {
      const s = readString(props.value, "ctaPosition", "below");
      if (s === "overlay" || s === "hidden") return s;
      return "below";
    })(),
  };

  const patch = (p: Partial<StorefrontHeroConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Hero / Banner</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Layout
        <select value={v.layout} onChange={(e) => patch({ layout: e.target.value as StorefrontHeroConfig["layout"] })} style={inputStyle}>
          <option value="centered">Centered</option>
          <option value="split">Split</option>
          <option value="editorial">Editorial</option>
          <option value="banner">Banner</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Text alignment
        <select value={v.alignment} onChange={(e) => patch({ alignment: e.target.value as StorefrontHeroConfig["alignment"] })} style={inputStyle}>
          <option value="center">Center</option>
          <option value="left">Left</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        CTA position
        <select value={v.ctaPosition} onChange={(e) => patch({ ctaPosition: e.target.value as StorefrontHeroConfig["ctaPosition"] })} style={inputStyle}>
          <option value="below">Below</option>
          <option value="overlay">Overlay</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.overlay} onChange={(e) => patch({ overlay: e.target.checked })} />
          Overlay
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.shadow} onChange={(e) => patch({ shadow: e.target.checked })} />
          Shadow
        </label>
      </div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Overlay strength: {v.overlayStrength.toFixed(2)}
        <input type="range" min={0} max={1} step={0.01} value={v.overlayStrength} onChange={(e) => patch({ overlayStrength: Number(e.target.value) })} />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Height: {v.height}px
        <input type="range" min={160} max={520} value={v.height} onChange={(e) => patch({ height: Number(e.target.value) })} />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Radius: {v.radius}px
        <input type="range" min={0} max={40} value={v.radius} onChange={(e) => patch({ radius: Number(e.target.value) })} />
      </label>
    </div>
  );
}

