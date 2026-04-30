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

run("npx prisma migrate deploy");

const serve = spawnSync(process.execPath, ["dist/server/index.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(serve.status ?? 1);
