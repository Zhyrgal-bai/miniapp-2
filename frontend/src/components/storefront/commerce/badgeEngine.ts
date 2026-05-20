import type { Product } from "../../../types";
import { ru } from "../../../i18n/ru";

const BADGE_LABELS = ru.badges;

export type BadgeId =
  | "NEW"
  | "HOT"
  | "SALE"
  | "LIMITED"
  | "LOW_STOCK"
  | "BESTSELLER";

export type Badge = {
  id: BadgeId;
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
  priority: number; // higher = earlier
};

function sumStock(p: Product): number | null {
  // Best-effort: variants > sizes; otherwise unknown.
  if (Array.isArray(p.variants) && p.variants.length > 0) {
    let total = 0;
    for (const v of p.variants) {
      for (const s of v.sizes ?? []) total += Number(s.stock ?? 0) || 0;
    }
    return total;
  }
  if (Array.isArray(p.sizes) && p.sizes.length > 0) {
    let total = 0;
    for (const s of p.sizes) total += Number(s.stock ?? 0) || 0;
    return total;
  }
  return null;
}

function isNewByDate(p: Product): boolean {
  // If backend passes createdAt in any shape, attempt to read it.
  const anyP = p as unknown as { createdAt?: unknown };
  const raw = anyP.createdAt;
  const d = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : null;
  if (!d || !Number.isFinite(d.getTime())) return Boolean(p.isNew);
  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
}

export function computeBadges(params: {
  product: Product;
  businessType?: string;
  kit?: "minimal" | "luxury" | "fashion" | "neon" | "default";
}): Badge[] {
  const p = params.product;
  const bt = (params.businessType ?? "").toLowerCase();

  const badges: Badge[] = [];

  // SALE
  if (p.isSale || (typeof p.discountPercent === "number" && p.discountPercent > 0)) {
    badges.push({ id: "SALE", label: BADGE_LABELS.sale, tone: "danger", priority: 95 });
  }

  // NEW
  if (isNewByDate(p)) {
    badges.push({ id: "NEW", label: BADGE_LABELS.new, tone: "primary", priority: 80 });
  }

  // BESTSELLER / HOT from sold metric
  const sold = Number(p.sold ?? 0) || 0;
  const bestThreshold = bt === "fastfood" ? 40 : bt === "flowers" ? 12 : 25;
  const hotThreshold = bt === "fastfood" ? 18 : bt === "flowers" ? 6 : 12;
  if (sold >= bestThreshold) {
    badges.push({ id: "BESTSELLER", label: BADGE_LABELS.best, tone: "success", priority: 90 });
  } else if (sold >= hotThreshold) {
    badges.push({ id: "HOT", label: BADGE_LABELS.hot, tone: "warning", priority: 70 });
  }

  // LOW_STOCK
  const stock = sumStock(p);
  const lowThreshold = bt === "fastfood" ? 3 : bt === "flowers" ? 4 : 5;
  if (stock != null && stock > 0 && stock <= lowThreshold) {
    badges.push({ id: "LOW_STOCK", label: BADGE_LABELS.low, tone: "warning", priority: 85 });
  }

  // LIMITED (manual hook for now)
  const attrs =
    (p as unknown as { attributes?: unknown }).attributes &&
    typeof (p as unknown as { attributes?: unknown }).attributes === "object" &&
    !Array.isArray((p as unknown as { attributes?: unknown }).attributes)
      ? ((p as unknown as { attributes?: unknown }).attributes as Record<string, unknown>)
      : null;
  if (attrs?.limited === true) {
    badges.push({ id: "LIMITED", label: BADGE_LABELS.limited, tone: "neutral", priority: 75 });
  }

  return badges.sort((a, b) => b.priority - a.priority);
}

