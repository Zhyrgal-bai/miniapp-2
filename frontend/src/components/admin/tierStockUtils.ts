import { labelPrimaryOption, verticalProfileFor } from "@repo-shared/businessCommerce";

export type TierStockRow = {
  key: string;
  label: string;
  stock: number | "";
  enabled: boolean;
};

function sortTierKeys(businessType: string, keys: string[]): string[] {
  const profile = verticalProfileFor(businessType);
  if (profile.variantEditor !== "bouquet_tiers") return keys;
  return [...keys].sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, "ru");
  });
}

export function defaultTierRows(
  businessType: string,
  extraKeys: string[] = [],
): TierStockRow[] {
  const profile = verticalProfileFor(businessType);
  const keys = sortTierKeys(
    businessType,
    [
      ...new Set([
        ...profile.defaultPrimaryValues,
        ...extraKeys.map((k) => k.trim()).filter((k) => k !== ""),
      ]),
    ],
  );
  return keys.map((key) => ({
    key,
    label: labelPrimaryOption(businessType, key) || key,
    stock: "",
    enabled: false,
  }));
}

export function tierRowsToVariants(rows: TierStockRow[]): Array<{
  color: string;
  sizes: Array<{ size: string; stock: number }>;
}> {
  const sizes = rows
    .filter((r) => r.enabled)
    .map((r) => ({
      size: r.key,
      stock: typeof r.stock === "number" ? r.stock : 0,
    }));
  if (sizes.length === 0) return [];
  return [{ color: "", sizes }];
}

export function variantsToTierRows(
  businessType: string,
  variants: Array<{ color?: string; sizes?: Array<{ size?: string; stock?: number }> }> | undefined,
): TierStockRow[] {
  const v0 = variants?.[0];
  const map = new Map<string, number>();
  for (const s of v0?.sizes ?? []) {
    const k = String(s.size ?? "").trim();
    if (k) map.set(k, Math.max(0, Number(s.stock ?? 0)));
  }
  const defaults = defaultTierRows(businessType, [...map.keys()]);
  return defaults.map((d) => {
    const st = map.get(d.key);
    if (st == null) return d;
    return { ...d, enabled: true, stock: st };
  });
}
