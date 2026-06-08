import { prisma } from "../db.js";

export async function buildTemplateMigrationRiskSnapshot(): Promise<{
  generatedAt: string;
  checkpoints: Array<{
    id: string;
    ok: boolean;
    detail: string;
  }>;
  rollbackPlan: string[];
}> {
  const [universalBusinesses, pendingRegistrationUniversal, brokenProducts] =
    await Promise.all([
      prisma.business.count({ where: { businessType: "universal" as any } }),
      prisma.registrationRequest.count({
        where: { businessType: "universal" as any, status: "PENDING" as any },
      }),
      prisma.product.count({
        where: {
          OR: [
            { image: null },
            { name: "" },
          ] as any,
        },
      }),
    ]);

  const checkpoints = [
    {
      id: "universal-drain",
      ok: universalBusinesses === 0,
      detail: `universal stores: ${universalBusinesses}`,
    },
    {
      id: "pending-registration-legacy-type",
      ok: pendingRegistrationUniversal === 0,
      detail: `pending requests with universal: ${pendingRegistrationUniversal}`,
    },
    {
      id: "catalog-minimal-integrity",
      ok: brokenProducts === 0,
      detail: `products with broken minimal data: ${brokenProducts}`,
    },
  ];

  const rollbackPlan = [
    "Pause migration endpoints and keep registry in compatibility mode.",
    "Revert affected Business.businessType values from migration audit log/export.",
    "Keep universal read path enabled until operator review queue is drained.",
    "Disable ProductModalHost strategy routing with feature toggle fallback to legacy renderer.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    checkpoints,
    rollbackPlan,
  };
}

