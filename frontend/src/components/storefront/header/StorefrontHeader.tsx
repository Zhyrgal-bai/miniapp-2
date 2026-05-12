import { useMemo } from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";

type StorefrontHeaderConfig = {
  variant?: "centered" | "split" | "minimal" | "luxury" | "neon" | "commerce";
  titleText?: string;
  showAvatar?: boolean;
  showSearch?: boolean;
  sticky?: boolean;
  glass?: boolean;
  blur?: boolean;
  showDivider?: boolean;
  alignment?: "left" | "center";
  height?: "compact" | "normal" | "large";
  logoSize?: number;
  avatarSize?: number;
  padX?: number;
  padY?: number;
  titleStyle?: "normal" | "uppercase" | "wide";
  shadow?: boolean;
  border?: boolean;
};

function normalize(cfg: Record<string, unknown> | undefined): Required<StorefrontHeaderConfig> {
  const c = (cfg ?? {}) as StorefrontHeaderConfig;
  const height = c.height === "compact" || c.height === "large" ? c.height : "normal";
  const variant =
    c.variant === "centered" ||
    c.variant === "split" ||
    c.variant === "minimal" ||
    c.variant === "luxury" ||
    c.variant === "neon" ||
    c.variant === "commerce"
      ? c.variant
      : "commerce";
  const alignment = c.alignment === "left" ? "left" : "center";
  const titleStyle =
    c.titleStyle === "uppercase" || c.titleStyle === "wide" ? c.titleStyle : "normal";
  const logoSize =
    typeof c.logoSize === "number" && Number.isFinite(c.logoSize)
      ? Math.min(64, Math.max(18, Math.round(c.logoSize)))
      : 34;
  const avatarSize =
    typeof c.avatarSize === "number" && Number.isFinite(c.avatarSize)
      ? Math.min(56, Math.max(18, Math.round(c.avatarSize)))
      : 36;
  const padX =
    typeof c.padX === "number" && Number.isFinite(c.padX)
      ? Math.min(24, Math.max(6, Math.round(c.padX)))
      : 12;
  const padY =
    typeof c.padY === "number" && Number.isFinite(c.padY)
      ? Math.min(18, Math.max(0, Math.round(c.padY)))
      : 8;
  return {
    variant,
    titleText: typeof c.titleText === "string" ? c.titleText.trim().slice(0, 32) : "",
    showAvatar: c.showAvatar !== false,
    showSearch: c.showSearch === true,
    sticky: c.sticky !== false,
    glass: c.glass === true,
    blur: c.blur !== false,
    showDivider: c.showDivider !== false,
    alignment,
    height,
    logoSize,
    avatarSize,
    padX,
    padY,
    titleStyle,
    shadow: c.shadow !== false,
    border: c.border === true,
  };
}

function titleText(cfg: Required<StorefrontHeaderConfig>, storeName: string | null): string {
  const custom = cfg.titleText.trim();
  if (custom) return custom;
  const fallback = storeName && storeName.trim() ? storeName.trim() : "SHOP";
  if (cfg.variant === "luxury") return fallback.toUpperCase();
  if (cfg.variant === "minimal") return fallback.toUpperCase();
  return fallback.toUpperCase();
}

type StorefrontKitId = "minimal" | "luxury" | "fashion" | "neon" | "default";

function HeaderMinimal(props: {
  cfg: Required<StorefrontHeaderConfig>;
  title: string;
  titleCss: React.CSSProperties;
}): React.ReactElement {
  // Minimal: left-aligned brand, no avatar, clean hierarchy.
  return (
    <div className="sf-header__inner sf-header__inner--minimal">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("sf:toggleMenu"))}
        className="sf-header__burger"
        aria-label="Меню"
        title="Меню"
      >
        ☰
      </button>
      <div
        className="sf-header__brand"
        style={{ ["--sf-logo-size"]: `${props.cfg.logoSize}px` } as React.CSSProperties}
      >
        <div className="sf-header__logo" aria-hidden />
        <div className="sf-header__title" style={props.titleCss}>
          {props.title}
        </div>
      </div>
      <div className="sf-header__right" />
    </div>
  );
}

export function StorefrontHeader(props: {
  theme: ResolvedStoreTheme;
  storeName?: string | null;
  config?: Record<string, unknown>;
  kit?: StorefrontKitId;
}): React.ReactElement {
  void props.theme;
  void props.kit;
  const rawCfg = useMemo(() => normalize(props.config), [props.config]);
  const kit = "minimal";
  const cfg: Required<StorefrontHeaderConfig> = useMemo(() => {
    const base = rawCfg;
    return {
      ...base,
      variant: "minimal",
      glass: false,
      blur: false,
      shadow: false,
      border: true,
      showDivider: false,
      showAvatar: false,
      alignment: "left",
      height: base.height === "normal" ? "compact" : base.height,
      titleStyle: base.titleStyle === "normal" ? "uppercase" : base.titleStyle,
    };
  }, [rawCfg]);

  const heightPx = cfg.height === "compact" ? 52 : cfg.height === "large" ? 76 : 64;
  const safeTop = useMemo(() => {
    const w = window as unknown as {
      Telegram?: {
        WebApp?: {
          safeAreaInset?: { top?: number };
          contentSafeAreaInset?: { top?: number };
          viewportStableHeight?: number;
        };
      };
    };
    const topA = w.Telegram?.WebApp?.safeAreaInset?.top;
    const topB = w.Telegram?.WebApp?.contentSafeAreaInset?.top;
    const top = typeof topA === "number" ? topA : typeof topB === "number" ? topB : 0;
    return Number.isFinite(top) ? Math.max(0, Math.min(80, Math.round(top))) : 0;
  }, []);
  const stickyStyle = cfg.sticky
    ? ({
        position: "sticky",
        top: 0,
        zIndex: 20,
      } as const)
    : null;

  const bg = "var(--sf-color-background)";
  const border = cfg.border ? "1px solid var(--sf-color-border)" : "1px solid transparent";
  const shadow = "none";

  const title = titleText(cfg, props.storeName ?? null);
  const titleCss: React.CSSProperties =
    cfg.titleStyle === "uppercase"
      ? { textTransform: "uppercase", letterSpacing: "0.12em" }
      : cfg.titleStyle === "wide"
        ? { textTransform: "uppercase", letterSpacing: "0.2em" }
        : { letterSpacing: "0.04em" };

  const headerClass = `sf-header sf-header--${kit}${cfg.showDivider ? "" : " sf-header--no-divider"}`;

  return (
    <div
      className={headerClass}
      style={{
        ...(stickyStyle ?? {}),
        // Safe-area is embedded into header (Telegram Mini App production-safe behavior).
        paddingTop: `max(env(safe-area-inset-top, 0px), ${safeTop}px)`,
        height: `calc(${heightPx}px + max(env(safe-area-inset-top, 0px), ${safeTop}px))`,
        ["--sf-header-pad-x" as string]: `${cfg.padX}px`,
        ["--sf-header-pad-y" as string]: `${cfg.padY}px`,
        background: bg,
        backdropFilter: undefined,
        WebkitBackdropFilter: undefined,
        borderBottom: border,
        boxShadow: shadow,
      }}
    >
      <div style={{ height: heightPx }}>
        <HeaderMinimal cfg={cfg} title={title} titleCss={titleCss} />
      </div>
    </div>
  );
}

