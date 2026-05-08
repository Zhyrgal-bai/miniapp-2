import React from "react";

export type StorefrontHeaderConfig = {
  variant: "centered" | "split" | "minimal" | "luxury" | "commerce";
  showAvatar: boolean;
  showSearch: boolean;
  sticky: boolean;
  glass: boolean;
  alignment: "left" | "center";
  height: "compact" | "normal" | "large";
  logoSize: number;
  titleStyle: "normal" | "uppercase" | "wide";
  shadow: boolean;
  border: boolean;
};

export function HeaderControls(props: {
  value: StorefrontHeaderConfig;
  onChange: (next: StorefrontHeaderConfig) => void;
}): React.ReactElement {
  const v = props.value;
  const patch = (p: Partial<StorefrontHeaderConfig>) => props.onChange({ ...v, ...p });

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Header</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Variant
        <select
          value={v.variant}
          onChange={(e) => patch({ variant: e.target.value as StorefrontHeaderConfig["variant"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="centered">Centered</option>
          <option value="split">Split</option>
          <option value="minimal">Minimal</option>
          <option value="luxury">Luxury</option>
          <option value="commerce">Commerce</option>
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.showAvatar}
            onChange={(e) => patch({ showAvatar: e.target.checked })}
          />
          Avatar
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.showSearch}
            onChange={(e) => patch({ showSearch: e.target.checked })}
          />
          Search
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.sticky}
            onChange={(e) => patch({ sticky: e.target.checked })}
          />
          Sticky
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.glass}
            onChange={(e) => patch({ glass: e.target.checked })}
          />
          Glass
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.border}
            onChange={(e) => patch({ border: e.target.checked })}
          />
          Border
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={v.shadow}
            onChange={(e) => patch({ shadow: e.target.checked })}
          />
          Shadow
        </label>
      </div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Alignment
        <select
          value={v.alignment}
          onChange={(e) => patch({ alignment: e.target.value as StorefrontHeaderConfig["alignment"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Height
        <select
          value={v.height}
          onChange={(e) => patch({ height: e.target.value as StorefrontHeaderConfig["height"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Title style
        <select
          value={v.titleStyle}
          onChange={(e) => patch({ titleStyle: e.target.value as StorefrontHeaderConfig["titleStyle"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="normal">Normal</option>
          <option value="uppercase">Uppercase</option>
          <option value="wide">Wide</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Logo size: {v.logoSize}px
        <input
          type="range"
          min={18}
          max={64}
          value={v.logoSize}
          onChange={(e) => patch({ logoSize: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

