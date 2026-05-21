import { labelPrimaryOption, verticalProfileFor } from "@repo-shared/businessCommerce";

export type TierStockRow = {
  key: string;
  label: string;
  stock: number | "";
  enabled: boolean;
};

export function defaultTierRows(businessType: string): TierStockRow[] {
  const profile = verticalProfileFor(businessType);
  return profile.defaultPrimaryValues.map((key) => ({
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
  const defaults = defaultTierRows(businessType);
  const v0 = variants?.[0];
  const map = new Map<string, number>();
  for (const s of v0?.sizes ?? []) {
    const k = String(s.size ?? "").trim();
    if (k) map.set(k, Math.max(0, Number(s.stock ?? 0)));
  }
  return defaults.map((d) => {
    const st = map.get(d.key);
    if (st == null) return d;
    return { ...d, enabled: true, stock: st };
  });
}
