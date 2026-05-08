import React from "react";

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export type StorefrontCartConfig = {
  itemStyle: "list" | "card";
  qtyStyle: "stepper" | "minimal";
  emptyStyle: "minimal" | "card";
  footerStyle: "sticky" | "inline";
};

export function CartControls(props: { value: unknown; onChange: (next: StorefrontCartConfig) => void }): React.ReactElement {
  const v: StorefrontCartConfig = {
    itemStyle: readString(props.value, "itemStyle", "list") === "card" ? "card" : "list",
    qtyStyle: readString(props.value, "qtyStyle", "stepper") === "minimal" ? "minimal" : "stepper",
    emptyStyle: readString(props.value, "emptyStyle", "minimal") === "card" ? "card" : "minimal",
    footerStyle: readString(props.value, "footerStyle", "sticky") === "inline" ? "inline" : "sticky",
  };
  const patch = (p: Partial<StorefrontCartConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Cart</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Item style
        <select value={v.itemStyle} onChange={(e) => patch({ itemStyle: e.target.value as StorefrontCartConfig["itemStyle"] })} style={inputStyle}>
          <option value="list">List</option>
          <option value="card">Cards</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Quantity control
        <select value={v.qtyStyle} onChange={(e) => patch({ qtyStyle: e.target.value as StorefrontCartConfig["qtyStyle"] })} style={inputStyle}>
          <option value="stepper">Stepper</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Empty state style
        <select value={v.emptyStyle} onChange={(e) => patch({ emptyStyle: e.target.value as StorefrontCartConfig["emptyStyle"] })} style={inputStyle}>
          <option value="minimal">Minimal</option>
          <option value="card">Card</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Footer style
        <select value={v.footerStyle} onChange={(e) => patch({ footerStyle: e.target.value as StorefrontCartConfig["footerStyle"] })} style={inputStyle}>
          <option value="sticky">Sticky</option>
          <option value="inline">Inline</option>
        </select>
      </label>
    </div>
  );
}

