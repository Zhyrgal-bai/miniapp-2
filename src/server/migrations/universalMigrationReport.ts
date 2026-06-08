import { prisma } from "../db.js";
import {
  classifyUniversalBusiness,
  type UniversalClassifierResult,
} from "./universalTypeClassifier.js";

type UniversalBusinessLite = {
  id: number;
  name: string;
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

function toClassifier(
  b: UniversalBusinessLite,
): UniversalClassifierResult {
  const merchantConfig =
    b.merchantConfig != null &&
    typeof b.merchantConfig === "object" &&
    !Array.isArray(b.merchantConfig)
      ? (b.merchantConfig as Record<string, unknown>)
      : {};
  return classifyUniversalBusiness({
    merchantConfig,
    productSignals: attributesSignal(b.products),
  });
}

export async function buildUniversalMigrationReport(): Promise<{
  generatedAt: string;
  totalUniversal: number;
  byProposedType: Record<string, number>;
  requiresOperatorReview: number;
  items: Array<{
    businessId: number;
    name: string;
    proposedType: string;
    confidence: string;
    ambiguous: boolean;
    reasons: string[];
  }>;
}> {
  const rows = await prisma.business.findMany({
    where: { businessType: "universal" as any },
    select: {
      id: true,
      name: true,
      merchantConfig: true,
      products: { select: { attributes: true } },
    },
    orderBy: { id: "asc" },
  });

  const byProposedType: Record<string, number> = {};
  const items = rows.map((b) => {
    const c = toClassifier(b);
    byProposedType[c.proposedType] = (byProposedType[c.proposedType] ?? 0) + 1;
    return {
      businessId: b.id,
      name: b.name,
      proposedType: c.proposedType,
      confidence: c.confidence,
      ambiguous: c.ambiguous,
      reasons: c.reasons,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalUniversal: rows.length,
    byProposedType,
    requiresOperatorReview: items.filter((x) => x.ambiguous).length,
    items,
  };
}

