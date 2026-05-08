import { useMemo } from "react";
import { getTelegramUser } from "../../../utils/telegram";
import { telegramDisplayInitial, telegramDisplayName } from "../../../utils/telegramUserMark";
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

function HeaderLuxury(props: {
  cfg: Required<StorefrontHeaderConfig>;
  title: string;
  titleCss: React.CSSProperties;
  userName: string | null;
  initial: string;
  photoUrl: string | null;
}): React.ReactElement {
  // Luxury: centered brand, avatar on right, hierarchy: brand first.
  return (
    <div className="sf-header__inner sf-header__inner--luxury">
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
        className="sf-header__brand sf-header__brand--center"
        style={
          {
            ["--sf-logo-size"]: `${props.cfg.logoSize}px`,
            ["--sf-avatar-size"]: `${props.cfg.avatarSize}px`,
          } as React.CSSProperties
        }
      >
        <div className="sf-header__title sf-header__title--luxury" style={props.titleCss}>
          {props.title}
        </div>
        {props.cfg.showDivider ? <div className="sf-header__divider" aria-hidden /> : null}
      </div>
      <div className="sf-header__right">
        {props.cfg.showAvatar ? (
          <div className="sf-header__user" style={{ minWidth: 0 }}>
            <div className="sf-header__avatar" aria-hidden title={props.userName ?? undefined}>
              {props.photoUrl ? (
                <img
                  src={props.photoUrl}
                  alt={props.userName ?? ""}
                  width={props.cfg.avatarSize}
                  height={props.cfg.avatarSize}
                />
              ) : (
                <span style={{ fontWeight: 900, opacity: 0.9 }}>{props.initial}</span>
              )}
            </div>
            {props.userName ? <div className="sf-header__user-name">{props.userName}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderFashion(props: {
  cfg: Required<StorefrontHeaderConfig>;
  title: string;
  userName: string | null;
  initial: string;
  photoUrl: string | null;
}): React.ReactElement {
  // Fashion: asymmetric editorial split (logo+title on left, avatar as accent).
  return (
    <div className="sf-header__inner sf-header__inner--fashion">
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
        className="sf-header__brand sf-header__brand--fashion"
        style={{ ["--sf-logo-size"]: `${props.cfg.logoSize}px` } as React.CSSProperties}
      >
        <div className="sf-header__logo" aria-hidden />
        <div className="sf-header__stack">
          <div className="sf-header__eyebrow">NEW DROP</div>
          <div className="sf-header__title sf-header__title--fashion">{props.title}</div>
        </div>
      </div>
      <div className="sf-header__right">
        {props.cfg.showAvatar ? (
          <div className="sf-header__avatar sf-header__avatar--accent" aria-hidden title={props.userName ?? undefined}>
            {props.photoUrl ? (
              <img
                src={props.photoUrl}
                alt={props.userName ?? ""}
                width={props.cfg.avatarSize}
                height={props.cfg.avatarSize}
              />
            ) : (
              <span style={{ fontWeight: 900, opacity: 0.9 }}>{props.initial}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderNeon(props: {
  cfg: Required<StorefrontHeaderConfig>;
  title: string;
}): React.ReactElement {
  // Neon: centered cyber bar, title only, no avatar. Emphasis on glow divider.
  return (
    <div className="sf-header__inner sf-header__inner--neon">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("sf:toggleMenu"))}
        className="sf-header__burger"
        aria-label="Меню"
        title="Меню"
      >
        ☰
      </button>
      <div className="sf-header__brand sf-header__brand--neon">
        <div className="sf-header__title sf-header__title--neon">{props.title}</div>
        {props.cfg.showDivider ? <div className="sf-header__neon-line" aria-hidden /> : null}
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
  const rawCfg = useMemo(() => normalize(props.config), [props.config]);
  const kit = props.kit ?? "default";
  const cfg: Required<StorefrontHeaderConfig> = useMemo(() => {
    // Kit-driven defaults (merchant can still override via builder config).
    const base = rawCfg;
    const variant =
      base.variant === "commerce" && kit !== "default"
        ? kit === "minimal"
          ? "minimal"
          : kit === "luxury"
            ? "luxury"
            : kit === "fashion"
              ? "split"
              : kit === "neon"
                ? "neon"
                : base.variant
        : base.variant;
    if (kit === "minimal") {
      return {
        ...base,
        variant,
        glass: base.glass || false,
        shadow: false,
        border: true,
        height: base.height === "normal" ? "compact" : base.height,
        alignment: "left" as const,
        titleStyle: base.titleStyle === "normal" ? "uppercase" : base.titleStyle,
        showAvatar: false,
      };
    }
    if (kit === "luxury") {
      return {
        ...base,
        variant,
        glass: true,
        shadow: true,
        border: true,
        height: base.height === "normal" ? "large" : base.height,
        alignment: "center" as const,
        titleStyle: "wide",
        showAvatar: true,
      };
    }
    if (kit === "fashion") {
      return {
        ...base,
        variant,
        glass: false,
        shadow: false,
        border: false,
        height: base.height === "normal" ? "large" : base.height,
        alignment: "left" as const,
        titleStyle: "normal",
        showAvatar: true,
      };
    }
    if (kit === "neon") {
      return {
        ...base,
        variant,
        glass: true,
        shadow: true,
        border: true,
        height: base.height === "normal" ? "compact" : base.height,
        alignment: "center" as const,
        titleStyle: "uppercase",
        showAvatar: false,
        showDivider: true,
      };
    }
    return { ...base, variant };
  }, [rawCfg, kit]);
  const user = useMemo(() => getTelegramUser(), []);
  const name = useMemo(() => telegramDisplayName(user), [user]);
  const initial = telegramDisplayInitial(user);

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

  const bg =
    cfg.glass
      ? kit === "luxury"
        ? "rgba(10,9,8,0.58)"
        : kit === "neon"
          ? "rgba(2,6,23,0.55)"
          : "rgba(15,23,42,0.55)"
      : "var(--sf-color-background)";
  const border =
    cfg.border
      ? kit === "neon"
        ? "1px solid color-mix(in srgb, var(--sf-color-primary) 45%, transparent)"
        : "1px solid var(--sf-color-border)"
      : "1px solid transparent";
  const shadow =
    cfg.shadow
      ? kit === "neon"
        ? "0 18px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(34,211,238,0.10)"
        : kit === "luxury"
          ? "0 18px 70px rgba(0,0,0,0.55)"
          : "0 10px 26px rgba(0,0,0,0.22)"
      : "none";

  const title = titleText(cfg, props.storeName ?? null);
  const titleCss: React.CSSProperties =
    cfg.titleStyle === "uppercase"
      ? { textTransform: "uppercase", letterSpacing: kit === "minimal" ? "0.22em" : "0.24em" }
      : cfg.titleStyle === "wide"
        ? { textTransform: "uppercase", letterSpacing: kit === "luxury" ? "0.32em" : "0.28em" }
        : kit === "fashion"
          ? { letterSpacing: "0.02em" }
          : { letterSpacing: "0.08em" };

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
        backdropFilter: cfg.glass && cfg.blur ? "blur(12px)" : undefined,
        WebkitBackdropFilter: cfg.glass && cfg.blur ? "blur(12px)" : undefined,
        borderBottom: border,
        boxShadow: shadow,
      }}
    >
      <div style={{ height: heightPx }}>
        {cfg.variant === "luxury" ? (
          <HeaderLuxury
            cfg={cfg}
            title={title}
            titleCss={titleCss}
            userName={name}
            initial={initial}
            photoUrl={user?.photo_url ?? null}
          />
        ) : cfg.variant === "split" ? (
          <HeaderFashion
            cfg={cfg}
            title={title}
            userName={name}
            initial={initial}
            photoUrl={user?.photo_url ?? null}
          />
        ) : cfg.variant === "neon" ? (
          <HeaderNeon cfg={cfg} title={title} />
        ) : (
          <HeaderMinimal cfg={cfg} title={title} titleCss={titleCss} />
        )}
      </div>
    </div>
  );
}

