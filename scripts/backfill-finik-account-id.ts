/**
 * Одноразовый скрипт: pending RegistrationRequest с finikApiKey без finikAccountId
 * (legacy заявки Phase 1). Не трогает Business — мерчант дополняет Account ID в настройках.
 *
 * Запуск: npx tsx scripts/backfill-finik-account-id.ts
 */
import { prisma } from "../src/server/db.js";

async function main(): Promise<void> {
  const rows = await prisma.registrationRequest.findMany({
    where: {
      finikApiKey: { not: null },
      finikAccountId: null,
      status: "PENDING",
    },
    select: { id: true, name: true },
  });
  console.log(
    `[backfill-finik-account-id] pending requests with key-only Finik: ${rows.length}`,
  );
  for (const r of rows) {
    console.log(`  #${r.id} ${r.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
