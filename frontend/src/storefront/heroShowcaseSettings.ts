export type HeroShowcaseDirection = "left" | "right";
export type HeroShowcaseSpeed = "slow" | "medium" | "fast";

export type HeroShowcaseSettings = {
  autoMove: boolean;
  direction: HeroShowcaseDirection;
  speed: HeroShowcaseSpeed;
  pauseOnTouch: boolean;
  pauseOnHover: boolean;
  infiniteLoop: boolean;
};

export const DEFAULT_HERO_SHOWCASE: HeroShowcaseSettings = {
  autoMove: true,
  direction: "left",
  speed: "medium",
  pauseOnTouch: true,
  pauseOnHover: true,
  infiniteLoop: true,
};

/** CSS animation duration for one full loop (duplicated track). */
export const HERO_SHOWCASE_SPEED_SECONDS: Record<HeroShowcaseSpeed, number> = {
  slow: 58,
  medium: 38,
  fast: 24,
};

function readBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function parseHeroShowcaseSettings(heroStyle: Record<string, unknown> | undefined): HeroShowcaseSettings {
  const raw = heroStyle?.showcase;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_HERO_SHOWCASE };
  }
  const o = raw as Record<string, unknown>;
  const dir = o.direction === "right" ? "right" : "left";
  const speed =
    o.speed === "slow" || o.speed === "fast" ? o.speed : ("medium" as HeroShowcaseSpeed);
  return {
    autoMove: readBool(o.autoMove, DEFAULT_HERO_SHOWCASE.autoMove),
    direction: dir,
    pauseOnTouch: readBool(o.pauseOnTouch, DEFAULT_HERO_SHOWCASE.pauseOnTouch),
    pauseOnHover: readBool(o.pauseOnHover, DEFAULT_HERO_SHOWCASE.pauseOnHover),
    infiniteLoop: readBool(o.infiniteLoop, DEFAULT_HERO_SHOWCASE.infiniteLoop),
    speed,
  };
}
