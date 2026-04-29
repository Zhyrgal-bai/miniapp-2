/**
 * Runs `prisma migrate deploy`. If the DB is non-empty and Prisma returns P3005,
 * baselines the initial migration once, then deploys again. Render-friendly.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const INIT_MIGRATION = "20250430120000_init";

function runShell(cmd) {
  const r = spawnSync(cmd, {
    encoding: "utf8",
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { status: r.status ?? 1, out };
}

function migrateDeploy() {
  const r = runShell("npx prisma migrate deploy");
  process.stdout.write(r.out);
  return r;
}

let { status, out } = migrateDeploy();

if (status !== 0) {
  if (!out.includes("P3005")) {
    process.exit(status);
  }
  process.stderr.write(
    `[migrate] Non-empty DB (P3005): baselining ${INIT_MIGRATION}, then deploy again.\n`,
  );
  const resolveR = runShell(
    `npx prisma migrate resolve --applied ${INIT_MIGRATION}`,
  );
  process.stdout.write(resolveR.out);
  if (resolveR.status !== 0) {
    process.exit(resolveR.status);
  }
  ({ status, out } = migrateDeploy());
  if (status !== 0) {
    process.exit(status);
  }
}

const serve = spawnSync(process.execPath, ["dist/server/index.js"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(serve.status ?? 1);
