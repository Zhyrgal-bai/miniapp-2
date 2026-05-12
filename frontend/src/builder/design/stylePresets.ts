export type StorefrontStyleConfig = {
  layout: {
    density: "compact" | "normal" | "comfortable";
    sectionSpacing: number;
    productGap: number;
    mobilePadding: number;
    contentWidth: "full" | "narrow";
  };
  typography: {
    fontBody?: string;
    fontTitle?: string;
    fontButton?: string;
    titleSize: number;
    sectionTitleSize: number;
    buttonSize: number;
    titleWeight: number;
    uppercaseTitles: boolean;
    letterSpacing: number;
    lineHeight: number;
  };
  chips: {
    shape: "pill" | "square";
    style: "outline" | "filled";
    size: "sm" | "md" | "lg";
    radius: number;
    gap: number;
  };
  buttons: {
    radius: number;
    height: number;
    shadow: boolean;
    glow: boolean;
    variant: "filled" | "outline";
    compact: boolean;
    animationLevel: "off" | "low" | "high";
  };
  cart?: {
    itemStyle: "list" | "card";
    qtyStyle: "stepper" | "minimal";
    emptyStyle: "minimal" | "card";
    footerStyle: "sticky" | "inline";
  };
  drawer?: {
    background: "surface" | "background" | "glass";
    blur: boolean;
    activeStyle: "solid" | "outline";
    avatarShape: "circle" | "rounded";
    density: "compact" | "normal";
  };
  hero: {
    layout: "centered" | "split" | "banner" | "editorial";
    overlay: boolean;
    overlayStrength: number;
    height: number;
    radius: number;
    shadow: boolean;
    alignment: "left" | "center";
    ctaPosition: "below" | "overlay" | "hidden";
  };
};

export const STYLE_PRESETS: Record<"minimal" | "luxury" | "fashion" | "neon", StorefrontStyleConfig> = {
  minimal: {
    layout: { density: "compact", sectionSpacing: 12, productGap: 8, mobilePadding: 10, contentWidth: "full" },
    typography: {
      fontBody: "system",
      fontTitle: "system",
      fontButton: "system",
      titleSize: 22,
      sectionTitleSize: 14,
      buttonSize: 13,
      titleWeight: 800,
      uppercaseTitles: false,
      letterSpacing: 0,
      lineHeight: 1.15,
    },
    chips: { shape: "pill", style: "outline", size: "sm", radius: 32, gap: 6 },
    buttons: { radius: 12, height: 42, shadow: false, glow: false, variant: "outline", compact: true, animationLevel: "off" },
    cart: { itemStyle: "list", qtyStyle: "minimal", emptyStyle: "minimal", footerStyle: "sticky" },
    drawer: { background: "surface", blur: false, activeStyle: "outline", avatarShape: "circle", density: "compact" },
    hero: { layout: "centered", overlay: false, overlayStrength: 0.45, height: 260, radius: 18, shadow: false, alignment: "center", ctaPosition: "below" },
  },
  luxury: {
    layout: { density: "comfortable", sectionSpacing: 20, productGap: 12, mobilePadding: 14, contentWidth: "narrow" },
    typography: {
      fontBody: "inter",
      fontTitle: "playfairDisplay",
      fontButton: "inter",
      titleSize: 28,
      sectionTitleSize: 16,
      buttonSize: 13,
      titleWeight: 800,
      uppercaseTitles: true,
      letterSpacing: 0.14,
      lineHeight: 1.05,
    },
    chips: { shape: "pill", style: "outline", size: "md", radius: 32, gap: 8 },
    buttons: { radius: 18, height: 46, shadow: true, glow: false, variant: "filled", compact: false, animationLevel: "low" },
    cart: { itemStyle: "card", qtyStyle: "stepper", emptyStyle: "card", footerStyle: "sticky" },
    drawer: { background: "glass", blur: true, activeStyle: "solid", avatarShape: "rounded", density: "normal" },
    hero: { layout: "banner", overlay: true, overlayStrength: 0.7, height: 360, radius: 28, shadow: true, alignment: "center", ctaPosition: "overlay" },
  },
  fashion: {
    layout: { density: "normal", sectionSpacing: 18, productGap: 10, mobilePadding: 12, contentWidth: "full" },
    typography: {
      fontBody: "manrope",
      fontTitle: "bebasNeue",
      fontButton: "manrope",
      titleSize: 30,
      sectionTitleSize: 16,
      buttonSize: 13,
      titleWeight: 800,
      uppercaseTitles: true,
      letterSpacing: 0.22,
      lineHeight: 1.02,
    },
    chips: { shape: "square", style: "filled", size: "sm", radius: 10, gap: 8 },
    buttons: { radius: 10, height: 44, shadow: false, glow: false, variant: "filled", compact: true, animationLevel: "low" },
    cart: { itemStyle: "list", qtyStyle: "stepper", emptyStyle: "minimal", footerStyle: "sticky" },
    drawer: { background: "background", blur: false, activeStyle: "solid", avatarShape: "rounded", density: "compact" },
    hero: { layout: "editorial", overlay: false, overlayStrength: 0.55, height: 320, radius: 22, shadow: false, alignment: "left", ctaPosition: "below" },
  },
  neon: {
    layout: { density: "compact", sectionSpacing: 14, productGap: 8, mobilePadding: 10, contentWidth: "full" },
    typography: {
      fontBody: "manrope",
      fontTitle: "montserrat",
      fontButton: "manrope",
      titleSize: 24,
      sectionTitleSize: 14,
      buttonSize: 13,
      titleWeight: 900,
      uppercaseTitles: true,
      letterSpacing: 0.08,
      lineHeight: 1.1,
    },
    chips: { shape: "pill", style: "outline", size: "sm", radius: 32, gap: 6 },
    buttons: { radius: 14, height: 44, shadow: true, glow: true, variant: "filled", compact: true, animationLevel: "high" },
    cart: { itemStyle: "card", qtyStyle: "stepper", emptyStyle: "card", footerStyle: "sticky" },
    drawer: { background: "glass", blur: true, activeStyle: "outline", avatarShape: "circle", density: "compact" },
    hero: { layout: "split", overlay: true, overlayStrength: 0.78, height: 300, radius: 22, shadow: true, alignment: "left", ctaPosition: "overlay" },
  },
};

