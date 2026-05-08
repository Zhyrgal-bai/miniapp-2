import React from "react";

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readBool(obj: unknown, key: string, fallback: boolean): boolean {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : fallback;
}

export type StorefrontDrawerConfig = {
  background: "surface" | "background" | "glass";
  blur: boolean;
  activeStyle: "solid" | "outline";
  avatarShape: "circle" | "rounded";
  density: "compact" | "normal";
};

export function DrawerControls(props: { value: unknown; onChange: (next: StorefrontDrawerConfig) => void }): React.ReactElement {
  const v: StorefrontDrawerConfig = {
    background: ((): StorefrontDrawerConfig["background"] => {
      const s = readString(props.value, "background", "surface");
      if (s === "background" || s === "glass") return s;
      return "surface";
    })(),
    blur: readBool(props.value, "blur", true),
    activeStyle: readString(props.value, "activeStyle", "solid") === "outline" ? "outline" : "solid",
    avatarShape: readString(props.value, "avatarShape", "circle") === "rounded" ? "rounded" : "circle",
    density: readString(props.value, "density", "normal") === "compact" ? "compact" : "normal",
  };
  const patch = (p: Partial<StorefrontDrawerConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Drawer / Menu</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Background
        <select value={v.background} onChange={(e) => patch({ background: e.target.value as StorefrontDrawerConfig["background"] })} style={inputStyle}>
          <option value="surface">Surface</option>
          <option value="background">Background</option>
          <option value="glass">Glass</option>
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
        <input type="checkbox" checked={v.blur} onChange={(e) => patch({ blur: e.target.checked })} />
        Blur
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Active item style
        <select value={v.activeStyle} onChange={(e) => patch({ activeStyle: e.target.value as StorefrontDrawerConfig["activeStyle"] })} style={inputStyle}>
          <option value="solid">Solid</option>
          <option value="outline">Outline</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Avatar shape
        <select value={v.avatarShape} onChange={(e) => patch({ avatarShape: e.target.value as StorefrontDrawerConfig["avatarShape"] })} style={inputStyle}>
          <option value="circle">Circle</option>
          <option value="rounded">Rounded</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Menu density
        <select value={v.density} onChange={(e) => patch({ density: e.target.value as StorefrontDrawerConfig["density"] })} style={inputStyle}>
          <option value="normal">Normal</option>
          <option value="compact">Compact</option>
        </select>
      </label>
    </div>
  );
}

