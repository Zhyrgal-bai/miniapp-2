import { FONT_ALLOWLIST, isFontId } from "../themeStudio/fonts";

function getObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Plain storefront chrome only: one neutral kit so layout works without
 * luxury/fashion/neon visual systems (rebuild-friendly).
 */
export function kitFromTemplateId(templateId: string | null | undefined): string {
  void templateId;
  return "minimal";
}

/**
 * Maps `storefrontStyleConfig` from the storefront payload to CSS custom properties.
 * Single source for App shell (.sf-app) and StorefrontRenderer (.sf-root) so layout tokens never drift.
 */
export function buildStorefrontLayoutCssVars(
  storefrontStyleConfig: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const styleCfg = storefrontStyleConfig ?? {};
  const layout = getObj(styleCfg.layout);
  const typo = getObj(styleCfg.typography);
  const chips = getObj(styleCfg.chips);
  const buttons = getObj(styleCfg.buttons);
  const hero = getObj(styleCfg.hero);
  const cart = getObj(styleCfg.cart);
  const drawer = getObj(styleCfg.drawer);

  const fontStack = (id: unknown): string => {
    const v = isFontId(id) ? id : "system";
    const found = FONT_ALLOWLIST.find((f) => f.id === v);
    return found?.cssFamily ?? FONT_ALLOWLIST[0].cssFamily;
  };

  const densityScale =
    layout.density === "compact" ? 0.86 : layout.density === "comfortable" ? 1.14 : 1;

  const scaledPx = (v: unknown): string => {
    if (typeof v !== "number" || !Number.isFinite(v)) return "";
    return `${Math.round(v * densityScale)}px`;
  };

  const contentMax = layout.contentWidth === "narrow" ? "430px" : "100%";

  return {
    "--sf-density-scale": String(densityScale),
    "--sf-content-max": contentMax,
    "--sf-section-pad":
      scaledPx(layout.sectionSpacing) ||
      (typeof layout.sectionSpacing === "number" ? `${layout.sectionSpacing}px` : ""),
    "--sf-grid-gap":
      scaledPx(layout.productGap) ||
      (typeof layout.productGap === "number" ? `${layout.productGap}px` : ""),
    "--sf-mobile-pad":
      scaledPx(layout.mobilePadding) ||
      (typeof layout.mobilePadding === "number" ? `${layout.mobilePadding}px` : ""),
    "--sf-font-body": fontStack(typo.fontBody),
    "--sf-font-heading": fontStack(typo.fontTitle),
    "--sf-font-button": fontStack(typo.fontButton),
    "--sf-typo-title-size": typeof typo.titleSize === "number" ? `${typo.titleSize}px` : "",
    "--sf-typo-section-title-size":
      typeof typo.sectionTitleSize === "number" ? `${typo.sectionTitleSize}px` : "",
    "--sf-typo-button-size": typeof typo.buttonSize === "number" ? `${typo.buttonSize}px` : "",
    "--sf-typo-title-weight": typeof typo.titleWeight === "number" ? String(typo.titleWeight) : "",
    "--sf-typo-title-transform":
      typeof typo.uppercaseTitles === "boolean" ? (typo.uppercaseTitles ? "uppercase" : "none") : "",
    "--sf-typo-title-letter-spacing":
      typeof typo.letterSpacing === "number" ? `${typo.letterSpacing}em` : "",
    "--sf-typo-title-line-height":
      typeof typo.lineHeight === "number" ? String(typo.lineHeight) : "",
    "--sf-chip-radius": typeof chips.radius === "number" ? `${chips.radius}px` : "",
    "--sf-chip-gap": scaledPx(chips.gap) || (typeof chips.gap === "number" ? `${chips.gap}px` : ""),
    "--sf-chip-shape": typeof chips.shape === "string" ? String(chips.shape) : "",
    "--sf-chip-style": typeof chips.style === "string" ? String(chips.style) : "",
    "--sf-chip-size": typeof chips.size === "string" ? String(chips.size) : "",
    "--sf-button-radius": typeof buttons.radius === "number" ? `${buttons.radius}px` : "",
    "--sf-button-height": typeof buttons.height === "number" ? `${buttons.height}px` : "",
    "--sf-button-variant": typeof buttons.variant === "string" ? String(buttons.variant) : "",
    "--sf-button-shadow-enabled":
      typeof buttons.shadow === "boolean" ? (buttons.shadow ? "1" : "0") : "",
    "--sf-button-glow-enabled": typeof buttons.glow === "boolean" ? (buttons.glow ? "1" : "0") : "",
    "--sf-button-compact": typeof buttons.compact === "boolean" ? (buttons.compact ? "1" : "0") : "",
    "--sf-motion-level":
      typeof buttons.animationLevel === "string" ? String(buttons.animationLevel) : "",
    "--sf-cart-item-style": typeof cart.itemStyle === "string" ? String(cart.itemStyle) : "",
    "--sf-cart-empty-style": typeof cart.emptyStyle === "string" ? String(cart.emptyStyle) : "",
    "--sf-cart-footer-style": typeof cart.footerStyle === "string" ? String(cart.footerStyle) : "",
    "--sf-cart-qty-style": typeof cart.qtyStyle === "string" ? String(cart.qtyStyle) : "",
    "--sf-drawer-bg": typeof drawer.background === "string" ? String(drawer.background) : "",
    "--sf-drawer-blur": typeof drawer.blur === "boolean" ? (drawer.blur ? "1" : "0") : "",
    "--sf-drawer-active-style":
      typeof drawer.activeStyle === "string" ? String(drawer.activeStyle) : "",
    "--sf-drawer-avatar-shape":
      typeof drawer.avatarShape === "string" ? String(drawer.avatarShape) : "",
    "--sf-drawer-density": typeof drawer.density === "string" ? String(drawer.density) : "",
    "--sf-hero-height": typeof hero.height === "number" ? `${hero.height}px` : "",
    "--sf-hero-radius": typeof hero.radius === "number" ? `${hero.radius}px` : "",
    "--sf-hero-layout": typeof hero.layout === "string" ? String(hero.layout) : "",
    "--sf-hero-overlay": typeof hero.overlay === "boolean" ? (hero.overlay ? "1" : "0") : "",
    "--sf-hero-overlay-strength":
      typeof hero.overlayStrength === "number" ? String(hero.overlayStrength) : "",
    "--sf-hero-alignment": typeof hero.alignment === "string" ? String(hero.alignment) : "",
    "--sf-hero-cta-position":
      typeof hero.ctaPosition === "string" ? String(hero.ctaPosition) : "",
    "--sf-hero-shadow": typeof hero.shadow === "boolean" ? (hero.shadow ? "1" : "0") : "",
  };
}
