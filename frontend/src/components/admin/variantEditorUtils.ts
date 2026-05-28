/** Universal single-axis variant row (maps to OrderItem.size / ProductStock.size). */
export type VariantOptionRow = {
  id: string;
  label: string;
  stock: number | "";
};

export function newVariantRowId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `vr-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function createEmptyOptionRow(label = ""): VariantOptionRow {
  return { id: newVariantRowId(), label, stock: "" };
}

/** One blank row for new products — no preset tiers. */
export function defaultOptionRowsForCreate(): VariantOptionRow[] {
  return [createEmptyOptionRow()];
}

export function optionRowsToVariants(rows: VariantOptionRow[]): Array<{
  color: string;
  sizes: Array<{ size: string; stock: number }>;
}> {
  const sizes = rows
    .map((r) => ({
      size: r.label.trim(),
      stock: typeof r.stock === "number" ? r.stock : 0,
    }))
    .filter((s) => s.size !== "");
  if (sizes.length === 0) return [];
  return [{ color: "", sizes }];
}

export function variantsToOptionRows(
  _businessType: string,
  variants: Array<{ color?: string; sizes?: Array<{ size?: string; stock?: number }> }> | undefined,
): VariantOptionRow[] {
  const rows: VariantOptionRow[] = [];
  for (const group of variants ?? []) {
    const color = String(group.color ?? "").trim();
    if (color !== "" && color !== "default") continue;
    for (const s of group.sizes ?? []) {
      const label = String(s.size ?? "").trim();
      if (!label) continue;
      rows.push({
        id: newVariantRowId(),
        label,
        stock: Math.max(0, Number(s.stock ?? 0)),
      });
    }
  }
  if (rows.length === 0) return defaultOptionRowsForCreate();
  return rows;
}

export function validateOptionRows(
  rows: VariantOptionRow[],
  axisLabel: string,
): string | null {
  const active = rows.filter((r) => r.label.trim() !== "");
  if (active.length === 0) {
    return `Добавьте хотя бы один вариант (${axisLabel.toLowerCase()}).`;
  }
  for (const row of active) {
    const n = typeof row.stock === "number" ? row.stock : Number(row.stock);
    if (!Number.isFinite(n) || n <= 0) {
      return `Для «${row.label.trim()}» укажите остаток больше нуля.`;
    }
  }
  return null;
}
