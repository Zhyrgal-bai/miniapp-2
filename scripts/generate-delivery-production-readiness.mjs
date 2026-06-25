/**
 * Generate delivery production readiness report.
 * Usage: node scripts/generate-delivery-production-readiness.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "docs/audits/delivery-production-readiness.md");

const DELIVERY_TEST_FILES = [
  "tests/integration/deliveryFlowE2e.test.ts",
  "tests/smoke/hybridCheckoutDelivery.test.ts",
  "tests/smoke/deliveryFulfillmentService.test.ts",
  "tests/smoke/deliveryRecoveryService.test.ts",
  "tests/smoke/deliveryOperationsPhase6.test.ts",
  "tests/smoke/deliveryMerchantDashboardService.test.ts",
  "tests/smoke/deliveryTrackingService.test.ts",
  "tests/smoke/yandexWebhookService.test.ts",
  "tests/smoke/finikStorefrontCheckout.test.ts",
  "tests/smoke/checkoutOrderWrite.test.ts",
  "tests/smoke/deliveryEnginePhase7.test.ts",
  "tests/smoke/deliveryHealthService.test.ts",
  "tests/smoke/deliveryRefreshService.test.ts",
  "tests/smoke/deliveryStatusSyncService.test.ts",
  "tests/smoke/checkoutErrorSurface.test.ts",
  "tests/smoke/merchantDeliverySettings.test.ts",
];

const REQUIRED_MIGRATIONS = [
  "prisma/migrations/20260703120000_provider_delivery_phase3",
  "prisma/migrations/20260704120000_provider_delivery_tracking_phase4",
  "prisma/migrations/20260705120000_provider_delivery_recovery_phase5",
  "prisma/migrations/20260710120000_delivery_operations_phase6",
  "prisma/migrations/20260711120000_hybrid_checkout_delivery_phase8_5",
];

const REQUIRED_ENV = [
  { name: "DATABASE_URL", required: true, scope: "all" },
  { name: "API_URL", required: false, scope: "production webhooks" },
  { name: "RENDER_EXTERNAL_URL", required: false, scope: "Render fallback for API_URL" },
  { name: "BOT_TOKEN_SECRET_KEY", required: true, scope: "production auth" },
  { name: "TELEGRAM_WEBHOOK_SECRET", required: true, scope: "production Telegram" },
  { name: "FINIK_WEBHOOK_SIGNATURE_HEADER", required: false, scope: "Finik webhook verify" },
  { name: "YANDEX_DELIVERY_OAUTH_TOKEN", required: true, scope: "production live Yandex quotes" },
  { name: "YANDEX_DELIVERY_API_BASE", required: false, scope: "Yandex API (default cargo host)" },
  { name: "YANDEX_DELIVERY_USE_MOCK", required: false, scope: "dev only — forbidden in production" },
  { name: "FINIK_USE_MOCK", required: false, scope: "dev only — forbidden in production" },
  { name: "DELIVERY_RECOVERY_MAX_ATTEMPTS", required: false, scope: "recovery worker tuning" },
  { name: "DELIVERY_RECOVERY_RETRY_BASE_MS", required: false, scope: "recovery worker tuning" },
  { name: "FRONT_URL", required: false, scope: "storefront return URLs" },
  { name: "MINI_APP_URL", required: false, scope: "Telegram Web App links" },
];

function run(cmd, opts = {}) {
  return spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    cwd: root,
    env: process.env,
    ...opts,
  });
}

function checkMigration(name) {
  const dir = path.join(root, name);
  const sql = path.join(dir, "migration.sql");
  return fs.existsSync(dir) && fs.existsSync(sql);
}

function runVitest(files) {
  const fileArgs = files.map((f) => `"${f}"`).join(" ");
  const jsonOut = path.join(root, ".delivery-readiness-vitest.json");
  const cmd = `npx vitest run ${fileArgs} --reporter=json --outputFile="${jsonOut}"`;
  const result = run(cmd, { stdio: "pipe" });
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(jsonOut);
  } catch {
    /* ignore */
  }
  return {
    ok: (result.status ?? 1) === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    json: parsed,
    status: result.status ?? 1,
  };
}

function runEnvValidation() {
  const cmd =
    'npx tsx -e "import { validateEnvironment } from \'./src/server/envValidation.ts\'; console.log(JSON.stringify(validateEnvironment()));"';
  const result = run(cmd, { stdio: "pipe" });
  try {
    const line = (result.stdout ?? "").trim().split("\n").pop();
    return { ok: true, data: JSON.parse(line ?? "{}") };
  } catch {
    return { ok: false, data: { errors: ["Failed to run validateEnvironment"], warnings: [] } };
  }
}

function summarizeVitest(json) {
  if (!json) return { passed: 0, failed: 0, files: [] };
  const files = (json.testResults ?? []).map((f) => ({
    name: path.relative(root, f.name),
    status: f.status,
    passed: f.assertionResults?.filter((a) => a.status === "passed").length ?? 0,
    failed: f.assertionResults?.filter((a) => a.status === "failed").length ?? 0,
  }));
  const passed = files.reduce((s, f) => s + f.passed, 0);
  const failed = files.reduce((s, f) => s + f.failed, 0);
  return { passed, failed, files };
}

function buildReport({ generatedAt, vitest, migrations, env, build, prismaValidate }) {
  const vitestSummary = summarizeVitest(vitest.json);
  const passedChecks = [];
  const failedChecks = [];
  const warnings = [...(env.data?.warnings ?? [])];

  if (vitest.ok && vitestSummary.failed === 0) {
    passedChecks.push(
      `Delivery E2E + regression suite (${vitestSummary.passed} assertions across ${vitestSummary.files.length} files)`,
    );
  } else {
    failedChecks.push(
      `Delivery test suite — ${vitestSummary.failed} failed, ${vitestSummary.passed} passed`,
    );
  }

  for (const m of migrations.present) {
    passedChecks.push(`Migration present: \`${m}\``);
  }
  for (const m of migrations.missing) {
    failedChecks.push(`Migration missing: \`${m}\``);
  }

  if (prismaValidate.ok) {
    passedChecks.push("Prisma schema validates");
  } else {
    failedChecks.push("Prisma validate failed");
  }

  if (build.ok) {
    passedChecks.push("TypeScript production build (`npm run build`)");
  } else {
    failedChecks.push("Production build failed");
  }

  if (env.data?.ok) {
    passedChecks.push("Environment validation (current NODE_ENV) — no fatal errors");
  } else {
    for (const e of env.data?.errors ?? []) {
      if (process.env.NODE_ENV === "production") {
        failedChecks.push(`ENV: ${e}`);
      } else {
        warnings.push(`ENV (non-prod): ${e}`);
      }
    }
  }

  const scenarioRows = [
    ["Merchant fixed delivery", vitest.ok ? "PASS" : "FAIL", "E2E scenario 1 in deliveryFlowE2e.test.ts"],
    ["Yandex live delivery + claim + webhook + recovery", vitest.ok ? "PASS" : "FAIL", "E2E scenario 2"],
    ["Checkout / payment / dashboard / ops regression", vitest.ok ? "PASS" : "FAIL", "E2E scenario 3 + smoke suite"],
  ];

  const migrationTable = REQUIRED_MIGRATIONS.map((m) => {
    const present = migrations.present.includes(m);
    return `| \`${m}\` | ${present ? "required" : "MISSING"} | Phase delivery schema |`;
  }).join("\n");

  const envTable = REQUIRED_ENV.map(
    (e) => `| \`${e.name}\` | ${e.required ? "yes" : "no"} | ${e.scope} |`,
  ).join("\n");

  const testFileTable = vitestSummary.files
    .map((f) => `| \`${f.name}\` | ${f.status} | ${f.passed} | ${f.failed} |`)
    .join("\n");

  const overallReady =
    failedChecks.length === 0 && vitest.ok && build.ok && migrations.missing.length === 0;

  return `# Delivery Production Readiness

**Generated:** ${generatedAt}  
**Overall status:** ${overallReady ? "READY (automated checks)" : "NOT READY — see failed checks"}

Automated report from \`node scripts/generate-delivery-production-readiness.mjs\`. Re-run before each production deploy.

---

## Executive summary

| Scenario | Status | Evidence |
|----------|--------|----------|
${scenarioRows.map((r) => `| ${r[0]} | **${r[1]}** | ${r[2]} |`).join("\n")}

### Business rule reminder

**Merchant fallback (\`deliveryProvider=merchant\`)** — single Finik payment to merchant (\`order.total\` includes delivery fee). ARCHA does not hold merchant delivery fee. No \`ProviderDelivery\`, no provider claim, \`deliveryOfferId=null\`.

**Provider delivery (\`deliveryProvider=yandex\`, …)** — live offer, claim, \`ProviderDelivery\`, webhooks, recovery. Future split/payout applies only here.

---

## Passed checks

${passedChecks.length ? passedChecks.map((c) => `- ${c}`).join("\n") : "_None_"}

## Failed checks

${failedChecks.length ? failedChecks.map((c) => `- ${c}`).join("\n") : "_None_"}

## Warnings

${warnings.length ? [...new Set(warnings)].map((w) => `- ${w}`).join("\n") : "_None_"}

---

## E2E verification coverage

### Scenario 1 — Merchant fixed delivery

| Step | Verified |
|------|----------|
| Customer checkout quote via hybrid resolver | Merchant selected, \`calculationSource=fixed\` |
| \`order.total\` | Subtotal + fixed delivery fee |
| Finik payment session | Merchant tenant, full \`order.total\` amount |
| \`deliveryOfferId\` | \`null\` |
| \`ProviderDelivery\` | Not created |
| Fulfillment / Yandex claim | Not triggered |

### Scenario 2 — Yandex delivery

| Step | Verified |
|------|----------|
| Hybrid resolver | Live Yandex quote + \`providerOfferId\` |
| Post-payment fulfillment | \`ProviderDelivery\` + claim via engine |
| Webhook | \`YandexWebhookService\` refreshes tracking |
| Recovery | \`deliveryRecoveryService\` scans active deliveries |

### Scenario 3 — Regression

| Area | Verified via |
|------|----------------|
| Checkout helpers | \`checkoutOrderWrite\`, \`checkoutErrorSurface\` |
| Payment | \`finikStorefrontCheckout\` |
| Analytics | Hybrid checkout metrics counters |
| Dashboard | \`deliveryMerchantDashboardService\` |
| Timeline / ops | \`deliveryOperationsPhase6\`, \`deliveryTrackingService\` |
| Recovery | \`deliveryRecoveryService\` |

---

## Test run detail

| File | Status | Passed | Failed |
|------|--------|--------|--------|
${testFileTable || "| _no results_ | — | — | — |"}

---

## Required migrations

Apply with \`npx prisma migrate deploy\` before starting the server.

| Migration | Status | Notes |
|-----------|--------|-------|
${migrationTable}

---

## Required environment variables

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
${envTable}

**Production forbids:** \`YANDEX_DELIVERY_USE_MOCK\`, \`FINIK_USE_MOCK\`, \`SKIP_TELEGRAM_WEBAPP_AUTH=1\`, \`TELEGRAM_INIT_DEBUG=1\`, \`WEBHOOK_DEBUG=1\`.

**Per-merchant (database):** \`Business.finikApiKey\`, \`finikAccountId\`, \`finikSecret\` for storefront checkout payments.

---

## Deployment checklist

- [ ] \`npx prisma migrate deploy\` — all delivery migrations applied
- [ ] \`npm run build\` succeeds
- [ ] \`npm run test:delivery-e2e\` passes
- [ ] \`node scripts/generate-delivery-production-readiness.mjs\` — no failed checks
- [ ] \`YANDEX_DELIVERY_OAUTH_TOKEN\` set (live quotes)
- [ ] \`API_URL\` or \`RENDER_EXTERNAL_URL\` set (Finik + Yandex webhooks)
- [ ] Merchant Finik credentials configured for businesses accepting orders
- [ ] Verify hybrid checkout in staging: merchant zone + Yandex zone addresses
- [ ] Confirm merchant order: single Finik payment, no delivery ops row
- [ ] Confirm Yandex order: \`ProviderDelivery\` visible in merchant delivery dashboard

---

## Manual staging checks (not automated)

1. Place order with address outside Yandex but inside merchant tier → merchant fee, one payment.
2. Place order inside Yandex coverage → live fee, offer id on order, claim after payment.
3. Merchant delivery dashboard shows only provider deliveries (not merchant-owned).
4. Operations center search/export on a Yandex \`ProviderDelivery\` row.

---

## Regenerate

\`\`\`bash
npm run test:delivery-e2e
node scripts/generate-delivery-production-readiness.mjs
\`\`\`
`;
}

function main() {
  console.log("[delivery-readiness] Running verification…\n");

  const migrations = {
    present: REQUIRED_MIGRATIONS.filter((m) => checkMigration(m)),
    missing: REQUIRED_MIGRATIONS.filter((m) => !checkMigration(m)),
  };

  console.log("[delivery-readiness] Vitest delivery suite…");
  const vitest = runVitest(DELIVERY_TEST_FILES);

  console.log("[delivery-readiness] Prisma validate…");
  const prismaValidate = run("npx prisma validate", { stdio: "pipe" });

  console.log("[delivery-readiness] Environment validation…");
  const env = runEnvValidation();

  console.log("[delivery-readiness] Production build…");
  const build = run("npm run build", { stdio: "pipe" });

  const report = buildReport({
    generatedAt: new Date().toISOString(),
    vitest,
    migrations,
    env,
    build: { ok: (build.status ?? 1) === 0 },
    prismaValidate: { ok: (prismaValidate.status ?? 1) === 0 },
  });

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`\n[delivery-readiness] Report written: ${path.relative(root, reportPath)}`);

  if (!vitest.ok || migrations.missing.length > 0) {
    process.exit(1);
  }
}

main();
