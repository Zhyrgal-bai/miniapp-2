import { prisma } from "../db.js";
import { classifyUniversalBusiness } from "./universalTypeClassifier.js";

type UniversalBusiness = {
  id: number;
  merchantConfig: unknown;
  products: Array<{ attributes: unknown }>;
};

function attributesSignal(
  products: Array<{ attributes: unknown }>,
): {
  total: number;
  withVin: number;
  withCompatibility: number;
  withSpecifications: number;
  withIngredients: number;
  withDimensions: number;
  withVolume: number;
} {
  let withVin = 0;
  let withCompatibility = 0;
  let withSpecifications = 0;
  let withIngredients = 0;
  let withDimensions = 0;
  let withVolume = 0;
  for (const p of products) {
    const a =
      p.attributes != null &&
      typeof p.attributes === "object" &&
      !Array.isArray(p.attributes)
        ? (p.attributes as Record<string, unknown>)
        : {};
    if (typeof a.vin === "string" && a.vin.trim() !== "") withVin += 1;
    if (typeof a.compatibility === "string" && a.compatibility.trim() !== "") withCompatibility += 1;
    if (typeof a.specifications === "string" && a.specifications.trim() !== "") withSpecifications += 1;
    if (typeof a.ingredients === "string" && a.ingredients.trim() !== "") withIngredients += 1;
    if (typeof a.dimensions === "string" && a.dimensions.trim() !== "") withDimensions += 1;
    if (typeof a.volume === "string" && a.volume.trim() !== "") withVolume += 1;
  }
  return {
    total: products.length,
    withVin,
    withCompatibility,
    withSpecifications,
    withIngredients,
    withDimensions,
    withVolume,
  };
}

function merchantConfigOf(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

async function classifyUniversal(b: UniversalBusiness) {
  return classifyUniversalBusiness({
    merchantConfig: merchantConfigOf(b.merchantConfig),
    productSignals: attributesSignal(b.products),
  });
}

export async function runUniversalHybridMigration(params?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<{
  dryRun: boolean;
  inspected: number;
  migrated: number;
  queuedForReview: number;
  skippedLowConfidence: number;
  items: Array<{
    businessId: number;
    proposedType: string;
    confidence: string;
    migrated: boolean;
    queued: boolean;
  }>;
}> {
  const dryRun = params?.dryRun !== false;
  const limit = Math.max(1, Math.min(500, Number(params?.limit ?? 200)));
  const rows = await prisma.business.findMany({
    where: { businessType: "universal" as any },
    select: {
      id: true,
      merchantConfig: true,
      products: { select: { attributes: true } },
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  let migrated = 0;
  let queuedForReview = 0;
  let skippedLowConfidence = 0;
  const items: Array<{
    businessId: number;
    proposedType: string;
    confidence: string;
    migrated: boolean;
    queued: boolean;
  }> = [];

  for (const row of rows) {
    const c = await classifyUniversal(row);
    const shouldQueue = c.ambiguous;
    const shouldMigrate = !shouldQueue && c.confidence !== "low";

    if (shouldQueue) queuedForReview += 1;
    if (!shouldMigrate) skippedLowConfidence += 1;

    if (!dryRun && shouldMigrate) {
      await prisma.business.update({
        where: { id: row.id },
        data: { businessType: c.proposedType as any },
      });
      migrated += 1;
    }

    items.push({
      businessId: row.id,
      proposedType: c.proposedType,
      confidence: c.confidence,
      migrated: !dryRun && shouldMigrate,
      queued: shouldQueue,
    });
  }

  return {
    dryRun,
    inspected: rows.length,
    migrated,
    queuedForReview,
    skippedLowConfidence,
    items,
  };
}

