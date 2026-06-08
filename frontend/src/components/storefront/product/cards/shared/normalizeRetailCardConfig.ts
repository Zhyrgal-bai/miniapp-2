export type RetailCardConfig = {
  imageRatio: "square" | "portrait" | "landscape";
  imageFit: "cover" | "contain";
  rounded: boolean;
  density: "compact" | "normal" | "airy";
  priceStyle: "bold" | "luxury" | "compact";
};

export function normalizeRetailCardConfig(
  raw: Record<string, unknown> | undefined,
): RetailCardConfig {
  const c = raw ?? {};
  const getStr = (k: string): string | null =>
    typeof c[k] === "string" ? (c[k] as string) : null;
  const getBool = (k: string): boolean | null =>
    typeof c[k] === "boolean" ? (c[k] as boolean) : null;
  const imageRatio =
    getStr("imageRatio") === "portrait" || getStr("imageRatio") === "landscape"
      ? (getStr("imageRatio") as "portrait" | "landscape")
      : "square";
  const imageFit = getStr("imageFit") === "contain" ? "contain" : "cover";
  const density =
    getStr("density") === "compact" || getStr("density") === "airy"
      ? (getStr("density") as "compact" | "airy")
      : "normal";
  const priceStyle =
    getStr("priceStyle") === "luxury" || getStr("priceStyle") === "compact"
      ? (getStr("priceStyle") as "luxury" | "compact")
      : "bold";
  return {
    imageRatio,
    imageFit,
    rounded: getBool("rounded") !== false,
    density,
    priceStyle,
  };
}
