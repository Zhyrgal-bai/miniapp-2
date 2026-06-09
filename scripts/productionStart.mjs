/**
 * Render / production start: optional full public schema reset, baseline repair, migrate, server.
 * RESET_PUBLIC_SCHEMA=1 only when RENDER is set (avoid wiping local DB by mistake).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

/** Strip forbidden debug/auth bypass flags before server boot (Render dashboard leftovers). */
function sanitizeProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const forbidden = [
    ["TELEGRAM_INIT_DEBUG", "1"],
    ["SKIP_TELEGRAM_WEBAPP_AUTH", "1"],
    ["FINIK_USE_MOCK", "1"],
    ["FINIK_USE_MOCK", "true"],
  ];
  for (const [key, val] of forbidden) {
    if (process.env[key] === val) {
      console.warn(
        `[start] ${key}=${val} is forbidden in production — ignoring (remove from Render Environment).`,
      );
      delete process.env[key];
    }
  }
}

sanitizeProductionEnv();

function run(cmd) {
  const r = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  const code = r.status ?? 1;
  if (code !== 0) process.exit(code);
}

if (process.env.RESET_PUBLIC_SCHEMA === "1") {
  if (!process.env.RENDER) {
    console.error(
      "[start] RESET_PUBLIC_SCHEMA ignored: use only on Render (with RENDER set).",
    );
  } else {
    console.warn(
      "[start] RESET_PUBLIC_SCHEMA=1: dropping public schema (all data). Remove this env after one successful deploy.",
    );
    run("npx prisma db execute --file prisma/sql/reset_public_schema.sql");
  }
}

run("npx prisma db execute --file prisma/sql/repair_init_baseline_if_needed.sql");

const rolledBack = spawnSync(
  "npx prisma migrate resolve --rolled-back 20250430120000_init",
  {
    shell: true,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  },
);
const rbOut = (rolledBack.stdout ?? "") + (rolledBack.stderr ?? "");
// P3012 = migration not failed; benign on healthy DB. P3018 recovery still logs other errors.
if (rbOut && !rbOut.includes("P3012")) process.stdout.write(rbOut);

const deployAttempt = spawnSync("npx prisma migrate deploy", {
  shell: true,
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});
const deployOut = (deployAttempt.stdout ?? "") + (deployAttempt.stderr ?? "");
if (deployOut) process.stdout.write(deployOut);

// If a known migration is stuck as "failed" in production DB (P3009),
// automatically unmark it and retry. This is safe here because the SQL was
// made idempotent (CREATE TABLE IF NOT EXISTS + constraint guards).
if (
  (deployAttempt.status ?? 1) !== 0 &&
  deployOut.includes("P3009") &&
  deployOut.includes("20260508143000_storefront_table_reusable_blocks")
) {
  console.warn(
    "[start] Detected failed migration 20260508143000_storefront_table_reusable_blocks; attempting auto-resolve then redeploy.",
  );
  run(
    "npx prisma migrate resolve --rolled-back 20260508143000_storefront_table_reusable_blocks",
  );
  run("npx prisma migrate deploy");
} else if (
  (deployAttempt.status ?? 1) !== 0 &&
  deployOut.includes("P3009") &&
  deployOut.includes("20260622020000_business_staff")
) {
  console.warn(
    "[start] Detected failed migration 20260622020000_business_staff; attempting auto-resolve then redeploy.",
  );
  run(
    "npx prisma migrate resolve --rolled-back 20260622020000_business_staff",
  );
  run("npx prisma migrate deploy");
} else {
  const code = deployAttempt.status ?? 1;
  if (code !== 0) process.exit(code);
}

// One-off data backfills (Render only).
// Use env flags and remove them after one successful deploy.
if (process.env.BACKFILL_ENABLE_STOREFRONT === "1") {
  if (!process.env.RENDER) {
    console.error(
      "[start] BACKFILL_ENABLE_STOREFRONT ignored: use only on Render (with RENDER set).",
    );
  } else {
    console.warn(
      "[start] BACKFILL_ENABLE_STOREFRONT=1: enabling storefront (isActive=true) for all non-blocked businesses. Remove this env after one successful deploy.",
    );
    run(
      "npx prisma db execute --file prisma/sql/backfill_enable_storefront_active.sql",
    );
  }
}

if (process.env.BACKFILL_LEGACY_SLUGS === "1") {
  if (!process.env.RENDER) {
    console.error(
      "[start] BACKFILL_LEGACY_SLUGS ignored: use only on Render (with RENDER set).",
    );
  } else {
    console.warn(
      "[start] BACKFILL_LEGACY_SLUGS=1: legacy slug backfill (dry-run then apply). Remove this env after one successful deploy.",
    );
    run("npx tsx scripts/backfillSlugs.mjs");
    run("npx tsx scripts/backfillSlugs.mjs --apply");
  }
}

const serve = spawnSync(process.execPath, ["dist/server/index.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(serve.status ?? 1);
