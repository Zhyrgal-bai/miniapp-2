/**
 * Verify GET /api/storefront/:id/dining-tables (no auth) for coffee + fastfood venues.
 * Usage: node scripts/verify-storefront-dining-tables.mjs [baseUrl]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  businessTypeSupportsTableReservations,
} from "../dist/shared/tableReservation.js";

const base = (process.argv[2] ?? process.env.VERIFY_API_BASE ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const prisma = new PrismaClient();

async function probe(businessId) {
  const url = `${base}/api/storefront/${businessId}/dining-tables`;
  const res = await fetch(url, { method: "GET" });
  const body = await res.json().catch(() => ({}));
  return { url, status: res.status, body };
}

async function main() {
  const venues = await prisma.business.findMany({
    where: {
      businessType: { in: ["coffee", "fastfood"] },
      isActive: true,
      isBlocked: false,
    },
    select: { id: true, name: true, businessType: true },
    orderBy: { id: "asc" },
    take: 10,
  });

  const byType = { coffee: null, fastfood: null };
  for (const v of venues) {
    if (!businessTypeSupportsTableReservations(v.businessType)) continue;
    const key = v.businessType === "fastfood" ? "fastfood" : "coffee";
    if (byType[key] == null) byType[key] = v;
  }

  let failed = false;
  for (const [label, biz] of Object.entries(byType)) {
    if (!biz) {
      console.warn(`SKIP ${label}: no active venue in DB`);
      continue;
    }
    const tableCount = await prisma.diningTable.count({
      where: { businessId: biz.id, isActive: true },
    });
    const { status, body, url } = await probe(biz.id);
    const ok =
      status === 200 &&
      body.supported === true &&
      Array.isArray(body.tables) &&
      (tableCount === 0 || body.tables.length > 0);
    console.log(
      JSON.stringify({
        label,
        businessId: biz.id,
        dbTables: tableCount,
        url,
        status,
        supported: body.supported,
        tableCount: body.tables?.length ?? 0,
        ok,
      }),
    );
    if (status === 401 || status === 403 || status === 500) failed = true;
    if (tableCount > 0 && (body.tables?.length ?? 0) === 0) failed = true;
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
