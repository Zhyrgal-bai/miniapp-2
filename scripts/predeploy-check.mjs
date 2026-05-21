/**
 * Pre-deploy gate — run locally and in CI before production deploy.
 * Usage: node scripts/predeploy-check.mjs
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  if ((r.status ?? 1) !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log("[predeploy] Running release safety checks…");

run("npx prisma validate");
run("npm run check");
run("npm run test:smoke");

if (process.env.NODE_ENV === "production" || process.env.CI === "true") {
  const forbidden = [
    ["SKIP_TELEGRAM_WEBAPP_AUTH", "1"],
    ["TELEGRAM_INIT_DEBUG", "1"],
  ];
  for (const [key, val] of forbidden) {
    if (process.env[key] === val) {
      console.error(`[predeploy] FATAL: ${key}=${val} must not be set for production deploy`);
      process.exit(1);
    }
  }
}

console.log("\n[predeploy] All checks passed ✅");
