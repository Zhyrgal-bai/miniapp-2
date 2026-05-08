import React from "react";

export type StorefrontCardConfig = {
  variant: "minimal" | "modern" | "luxury" | "fashion" | "marketplace";
  imageRatio: "square" | "portrait" | "landscape";
  rounded: boolean;
  shadow: boolean;
  compact: boolean;
  showBadges: boolean;
  showWishlist: boolean;
  buttonStyle: "solid" | "outline" | "glass";
  textAlign: "left" | "center";
  hoverEffect: "none" | "scale" | "lift";
};

export function ProductCardControls(props: {
  value: StorefrontCardConfig;
  onChange: (next: StorefrontCardConfig) => void;
}): React.ReactElement {
  const v = props.value;
  const patch = (p: Partial<StorefrontCardConfig>) => props.onChange({ ...v, ...p });
  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Карточки товаров</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Variant
        <select
          value={v.variant}
          onChange={(e) => patch({ variant: e.target.value as StorefrontCardConfig["variant"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="minimal">Minimal</option>
          <option value="modern">Modern</option>
          <option value="luxury">Luxury</option>
          <option value="fashion">Fashion</option>
          <option value="marketplace">Marketplace</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Image ratio
        <select
          value={v.imageRatio}
          onChange={(e) => patch({ imageRatio: e.target.value as StorefrontCardConfig["imageRatio"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="square">Square</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.rounded} onChange={(e) => patch({ rounded: e.target.checked })} />
          Rounded
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.shadow} onChange={(e) => patch({ shadow: e.target.checked })} />
          Shadow
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.compact} onChange={(e) => patch({ compact: e.target.checked })} />
          Compact
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.showBadges} onChange={(e) => patch({ showBadges: e.target.checked })} />
          Badges
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={v.showWishlist} onChange={(e) => patch({ showWishlist: e.target.checked })} />
          Wishlist
        </label>
      </div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Button style
        <select
          value={v.buttonStyle}
          onChange={(e) => patch({ buttonStyle: e.target.value as StorefrontCardConfig["buttonStyle"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="solid">Solid</option>
          <option value="outline">Outline</option>
          <option value="glass">Glass</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Text align
        <select
          value={v.textAlign}
          onChange={(e) => patch({ textAlign: e.target.value as StorefrontCardConfig["textAlign"] })}
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
        Hover effect
        <select
          value={v.hoverEffect}
          onChange={(e) => patch({ hoverEffect: e.target.value as StorefrontCardConfig["hoverEffect"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="none">None</option>
          <option value="scale">Scale</option>
          <option value="lift">Lift</option>
        </select>
      </label>
    </div>
  );
}

