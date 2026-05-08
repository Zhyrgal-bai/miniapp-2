import React from "react";

function readNumber(obj: unknown, key: string, fallback: number): number {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export type StorefrontLayoutConfig = {
  density: "compact" | "normal" | "comfortable";
  sectionSpacing: number;
  productGap: number;
  mobilePadding: number;
  contentWidth: "full" | "narrow";
};

export function LayoutControls(props: { value: unknown; onChange: (next: StorefrontLayoutConfig) => void }): React.ReactElement {
  const v: StorefrontLayoutConfig = {
    density: ((): StorefrontLayoutConfig["density"] => {
      const s = readString(props.value, "density", "normal");
      if (s === "compact" || s === "comfortable") return s;
      return "normal";
    })(),
    sectionSpacing: readNumber(props.value, "sectionSpacing", 16),
    productGap: readNumber(props.value, "productGap", 10),
    mobilePadding: readNumber(props.value, "mobilePadding", 10),
    contentWidth: readString(props.value, "contentWidth", "full") === "narrow" ? "narrow" : "full",
  };

  const patch = (p: Partial<StorefrontLayoutConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Layout / Density</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Density
        <select value={v.density} onChange={(e) => patch({ density: e.target.value as StorefrontLayoutConfig["density"] })} style={inputStyle}>
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="comfortable">Comfortable</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Content width
        <select value={v.contentWidth} onChange={(e) => patch({ contentWidth: e.target.value as StorefrontLayoutConfig["contentWidth"] })} style={inputStyle}>
          <option value="full">Full</option>
          <option value="narrow">Narrow</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Section spacing: {v.sectionSpacing}px
        <input type="range" min={0} max={48} value={Math.min(48, Math.max(0, v.sectionSpacing))} onChange={(e) => patch({ sectionSpacing: Number(e.target.value) })} />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Product gap: {v.productGap}px
        <input type="range" min={0} max={32} value={Math.min(32, Math.max(0, v.productGap))} onChange={(e) => patch({ productGap: Number(e.target.value) })} />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Mobile padding: {v.mobilePadding}px
        <input type="range" min={0} max={28} value={Math.min(28, Math.max(0, v.mobilePadding))} onChange={(e) => patch({ mobilePadding: Number(e.target.value) })} />
      </label>
    </div>
  );
}

