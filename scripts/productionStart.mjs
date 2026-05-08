/**
 * Render / production start: optional full public schema reset, baseline repair, migrate, server.
 * RESET_PUBLIC_SCHEMA=1 only when RENDER is set (avoid wiping local DB by mistake).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

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
if (rbOut) process.stdout.write(rbOut);
// Exit 1 when there is no failed migration — safe to ignore (clears P3018 when applicable).

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

const serve = spawnSync(process.execPath, ["dist/server/index.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(serve.status ?? 1);
