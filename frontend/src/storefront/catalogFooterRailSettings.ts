export type CatalogFooterRailDirection = "left" | "right";
export type CatalogFooterRailSpeed = "slow" | "medium" | "fast";

export type CatalogFooterRailSettings = {
  autoMove: boolean;
  direction: CatalogFooterRailDirection;
  speed: CatalogFooterRailSpeed;
  pauseOnTouch: boolean;
  infiniteLoop: boolean;
};

export const DEFAULT_CATALOG_FOOTER_RAIL: CatalogFooterRailSettings = {
  autoMove: true,
  direction: "left",
  speed: "medium",
  pauseOnTouch: true,
  infiniteLoop: true,
};

export const CATALOG_FOOTER_RAIL_SPEED_SECONDS: Record<CatalogFooterRailSpeed, number> = {
  slow: 52,
  medium: 34,
  fast: 22,
};

function readBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function readRailObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Reads `catalogFooter.rail`, with legacy fallback from `hero.showcase`. */
export function parseCatalogFooterRailSettings(
  styleConfig: Record<string, unknown> | null | undefined,
): CatalogFooterRailSettings {
  const root = styleConfig ?? {};
  const cf = root.catalogFooter;
  const railFromFooter =
    cf && typeof cf === "object" && !Array.isArray(cf)
      ? readRailObject((cf as Record<string, unknown>).rail)
      : null;
  const legacyHero =
    root.hero && typeof root.hero === "object" && !Array.isArray(root.hero)
      ? readRailObject((root.hero as Record<string, unknown>).showcase)
      : null;
  const o = railFromFooter ?? legacyHero;
  if (!o) return { ...DEFAULT_CATALOG_FOOTER_RAIL };

  const dir = o.direction === "right" ? "right" : "left";
  const speed =
    o.speed === "slow" || o.speed === "fast" ? o.speed : ("medium" as CatalogFooterRailSpeed);
  return {
    autoMove: readBool(o.autoMove, DEFAULT_CATALOG_FOOTER_RAIL.autoMove),
    direction: dir,
    speed,
    pauseOnTouch: readBool(o.pauseOnTouch, DEFAULT_CATALOG_FOOTER_RAIL.pauseOnTouch),
    infiniteLoop: readBool(o.infiniteLoop, DEFAULT_CATALOG_FOOTER_RAIL.infiniteLoop),
  };
}
