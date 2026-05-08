import React from "react";

export type StorefrontCardConfig = {
  variant: "compact" | "minimal" | "modern" | "luxury" | "fashion" | "marketplace" | "neon";
  imageRatio: "square" | "portrait" | "landscape";
  imageFit: "cover" | "contain";
  imageShadow: boolean;
  rounded: boolean;
  shadow: boolean;
  compact: boolean;
  density: "compact" | "normal" | "airy";
  priceStyle: "bold" | "luxury" | "compact";
  showBadges: boolean;
  badgeStyle: "minimal" | "glow" | "luxury";
  badgePosition: "topLeft" | "topRight" | "bottomLeft";
  showWishlist: boolean;
  ctaStyle: "pill" | "square" | "glow" | "outline" | "full";
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
        Card type
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
          <option value="compact">Compact</option>
          <option value="minimal">Minimal</option>
          <option value="modern">Modern</option>
          <option value="luxury">Luxury</option>
          <option value="fashion">Fashion</option>
          <option value="marketplace">Marketplace</option>
          <option value="neon">Neon</option>
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
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Image fit
          <select
            value={v.imageFit}
            onChange={(e) => patch({ imageFit: e.target.value as StorefrontCardConfig["imageFit"] })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9, marginTop: 22 }}>
          <input type="checkbox" checked={v.imageShadow} onChange={(e) => patch({ imageShadow: e.target.checked })} />
          Image shadow
        </label>
      </div>

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
        CTA style
        <select
          value={v.ctaStyle}
          onChange={(e) => patch({ ctaStyle: e.target.value as StorefrontCardConfig["ctaStyle"] })}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.45)",
            color: "#fff",
            padding: "8px 10px",
          }}
        >
          <option value="pill">Pill</option>
          <option value="square">Square</option>
          <option value="glow">Glow</option>
          <option value="outline">Outline</option>
          <option value="full">Full width</option>
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Price style
          <select
            value={v.priceStyle}
            onChange={(e) => patch({ priceStyle: e.target.value as StorefrontCardConfig["priceStyle"] })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            <option value="bold">Bold</option>
            <option value="luxury">Luxury</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Density
          <select
            value={v.density}
            onChange={(e) => patch({ density: e.target.value as StorefrontCardConfig["density"] })}
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
            <option value="airy">Airy</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Badge style
          <select
            value={v.badgeStyle}
            onChange={(e) => patch({ badgeStyle: e.target.value as StorefrontCardConfig["badgeStyle"] })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            <option value="minimal">Minimal</option>
            <option value="glow">Glow</option>
            <option value="luxury">Luxury</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Badge position
          <select
            value={v.badgePosition}
            onChange={(e) => patch({ badgePosition: e.target.value as StorefrontCardConfig["badgePosition"] })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            <option value="topLeft">Top left</option>
            <option value="topRight">Top right</option>
            <option value="bottomLeft">Bottom left</option>
          </select>
        </label>
      </div>

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

