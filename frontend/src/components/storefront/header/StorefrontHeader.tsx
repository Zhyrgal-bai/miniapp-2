import { useMemo } from "react";
import { getTelegramUser } from "../../../utils/telegram";
import { telegramDisplayInitial, telegramDisplayName } from "../../../utils/telegramUserMark";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";

type StorefrontHeaderConfig = {
  variant?: "centered" | "split" | "minimal" | "luxury" | "commerce";
  showAvatar?: boolean;
  showSearch?: boolean;
  sticky?: boolean;
  glass?: boolean;
  alignment?: "left" | "center";
  height?: "compact" | "normal" | "large";
  logoSize?: number;
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
  return {
    variant,
    showAvatar: c.showAvatar !== false,
    showSearch: c.showSearch === true,
    sticky: c.sticky !== false,
    glass: c.glass === true,
    alignment,
    height,
    logoSize,
    titleStyle,
    shadow: c.shadow !== false,
    border: c.border === true,
  };
}

function titleText(theme: ResolvedStoreTheme, cfg: Required<StorefrontHeaderConfig>): string {
  const base = (theme as any)?.templateId ? String((theme as any).templateId) : "SHOP";
  if (cfg.variant === "luxury") return "BOUTIQUE";
  if (cfg.variant === "minimal") return "SHOP";
  return base.toUpperCase() === base ? base : "SHOP";
}

export function StorefrontHeader(props: {
  theme: ResolvedStoreTheme;
  config?: Record<string, unknown>;
}): React.ReactElement {
  const cfg = useMemo(() => normalize(props.config), [props.config]);
  const user = useMemo(() => getTelegramUser(), []);
  const name = useMemo(() => telegramDisplayName(user), [user]);
  const initial = telegramDisplayInitial(user);

  const heightPx = cfg.height === "compact" ? 52 : cfg.height === "large" ? 76 : 64;
  const stickyStyle = cfg.sticky
    ? ({
        position: "sticky",
        top: 0,
        zIndex: 20,
      } as const)
    : null;

  const bg = cfg.glass ? "rgba(15,23,42,0.55)" : "var(--sf-color-background)";
  const border = cfg.border ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent";
  const shadow = cfg.shadow ? "0 10px 26px rgba(0,0,0,0.22)" : "none";

  const alignJustify =
    cfg.variant === "split" ? "space-between" : cfg.alignment === "left" ? "flex-start" : "center";

  const title = titleText(props.theme, cfg);
  const titleCss: React.CSSProperties =
    cfg.titleStyle === "uppercase"
      ? { textTransform: "uppercase", letterSpacing: "0.24em" }
      : cfg.titleStyle === "wide"
        ? { textTransform: "uppercase", letterSpacing: "0.28em" }
        : { letterSpacing: "0.08em" };

  return (
    <div
      style={{
        ...(stickyStyle ?? {}),
        height: heightPx,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: alignJustify,
        gap: 10,
        background: bg,
        backdropFilter: cfg.glass ? "blur(12px)" : undefined,
        WebkitBackdropFilter: cfg.glass ? "blur(12px)" : undefined,
        borderBottom: border,
        boxShadow: shadow,
      }}
    >
      {cfg.variant !== "centered" ? (
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.06)" }} />
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: cfg.logoSize,
            height: cfg.logoSize,
            borderRadius: Math.round(cfg.logoSize / 3),
            background: "var(--sf-color-primary)",
            boxShadow: "0 10px 30px rgba(99,102,241,0.25)",
            flex: "0 0 auto",
          }}
        />
        <div
          style={{
            fontFamily: "var(--sf-font-heading)",
            fontWeight: 900,
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            ...titleCss,
          }}
        >
          {title}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {cfg.showSearch ? (
          <div
            title="Search"
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
              opacity: 0.9,
            }}
          >
            ⌕
          </div>
        ) : null}
        {cfg.showAvatar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(255,255,255,0.06)",
                display: "grid",
                placeItems: "center",
              }}
              aria-hidden
              title={user?.first_name?.trim() || user?.username || undefined}
            >
              {user?.photo_url ? (
                <img src={user.photo_url} alt={name ?? ""} width={36} height={36} />
              ) : (
                <span style={{ fontWeight: 900, opacity: 0.9 }}>{initial}</span>
              )}
            </div>
            {name ? (
              <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

