import "dotenv/config";
import { prisma } from "../src/server/db.js";
import { businessTypeSupportsTableReservations } from "../src/shared/tableReservation.js";
import { isTableBookableLive } from "../src/server/tableReservationService.js";

const timeout = setTimeout(() => {
  console.error("DB probe timeout");
  process.exit(2);
}, 15000);

async function main() {
  const venues = await prisma.business.findMany({
    where: {
      businessType: { in: ["coffee", "fastfood"] },
      isActive: true,
      isBlocked: false,
    },
    select: { id: true, businessType: true, name: true },
    orderBy: { id: "asc" },
    take: 10,
  });

  const report = [];
  for (const v of venues) {
    if (!businessTypeSupportsTableReservations(v.businessType)) continue;
    const tables = await prisma.diningTable.findMany({
      where: { businessId: v.id, isActive: true },
      orderBy: { id: "asc" },
    });
    report.push({
      businessId: v.id,
      type: v.businessType,
      name: v.name,
      tableCount: tables.length,
      sample: tables.slice(0, 2).map((t) => ({
        id: t.id,
        liveStatus: t.liveStatus,
        bookable: isTableBookableLive(t.liveStatus),
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        shape: t.shape,
      })),
    });
  }
  console.log(JSON.stringify({ ok: true, venues: report }, null, 2));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
