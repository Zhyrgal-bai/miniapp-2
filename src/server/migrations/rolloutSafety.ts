import { prisma } from "../db.js";

export type RolloutStage = "compatibility" | "migration" | "decommission";

export async function computeRolloutSafetyStatus(): Promise<{
  stage: RolloutStage;
  totalBusinesses: number;
  universalBusinesses: number;
  universalShare: number;
  canDecommissionUniversal: boolean;
}> {
  const [totalBusinesses, universalBusinesses] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { businessType: "universal" as any } }),
  ]);
  const share =
    totalBusinesses > 0 ? universalBusinesses / totalBusinesses : 0;

  let stage: RolloutStage = "compatibility";
  if (universalBusinesses === 0) stage = "decommission";
  else if (share <= 0.2) stage = "migration";

  return {
    stage,
    totalBusinesses,
    universalBusinesses,
    universalShare: Number(share.toFixed(4)),
    canDecommissionUniversal: universalBusinesses === 0,
  };
}

