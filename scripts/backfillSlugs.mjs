/**
 * Legacy slug backfill CLI (Phase 17.3).
 * Default: dry-run. Pass --apply to write changes.
 *
 *   node scripts/backfillSlugs.mjs
 *   node scripts/backfillSlugs.mjs --apply
 */
const apply = process.argv.includes("--apply");

const { backfillLegacyBusinessSlugs } = await import(
  "../src/server/merchantSlugBackfill.ts"
);
const { prisma } = await import("../src/server/db.ts");

function formatEntry(e) {
  const from = e.from ?? "(null)";
  const to = e.to ?? "(unchanged)";
  return `  #${e.id} ${from} → ${to} [${e.status}]`;
}

try {
  const mode = apply ? "apply" : "dry-run";
  console.log(`[backfill-slugs] starting (${mode})`);

  const result = await backfillLegacyBusinessSlugs({ dryRun: !apply });
  const actionable = result.entries.filter(
    (e) => e.status === "dry_run" || e.status === "updated",
  );
  const skipped = result.entries.length - actionable.length;

  for (const e of result.entries) {
    if (e.status === "dry_run" || e.status === "updated") {
      console.log(formatEntry(e));
    }
  }

  console.log(
    `[backfill-slugs] done: ${actionable.length} ${apply ? "updated" : "planned"}, ${skipped} skipped`,
  );
} catch (err) {
  console.error("[backfill-slugs] failed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

if (process.exitCode) process.exit(process.exitCode);
