#!/usr/bin/env node
/**
 * Summarize npm audit for root + frontend. Exit 1 on critical vulnerabilities.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function runAudit(cwd, label) {
  if (!existsSync(resolve(cwd, "package.json"))) {
    console.warn(`[security-audit] skip ${label}: no package.json`);
    return { critical: 0, high: 0, moderate: 0, low: 0 };
  }
  try {
    const out = execSync("npm audit --json", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const data = JSON.parse(out);
    const meta = data.metadata?.vulnerabilities ?? {};
    return {
      critical: meta.critical ?? 0,
      high: meta.high ?? 0,
      moderate: meta.moderate ?? 0,
      low: meta.low ?? 0,
    };
  } catch (e) {
    const stdout = e?.stdout?.toString?.() ?? "";
    if (stdout) {
      try {
        const data = JSON.parse(stdout);
        const meta = data.metadata?.vulnerabilities ?? {};
        return {
          critical: meta.critical ?? 0,
          high: meta.high ?? 0,
          moderate: meta.moderate ?? 0,
          low: meta.low ?? 0,
        };
      } catch {
        /* fall through */
      }
    }
    console.error(`[security-audit] ${label} audit failed:`, e?.message ?? e);
    return { critical: 0, high: 0, moderate: 0, low: 0, error: true };
  }
}

const rootCounts = runAudit(root, "root");
const frontendCounts = runAudit(resolve(root, "frontend"), "frontend");

const total = {
  critical: rootCounts.critical + frontendCounts.critical,
  high: rootCounts.high + frontendCounts.high,
  moderate: rootCounts.moderate + frontendCounts.moderate,
  low: rootCounts.low + frontendCounts.low,
};

console.log("[security-audit] root:", rootCounts);
console.log("[security-audit] frontend:", frontendCounts);
console.log("[security-audit] total:", total);

if (total.critical > 0) {
  console.error(
    `[security-audit] FATAL: ${total.critical} critical vulnerability(ies)`,
  );
  process.exit(1);
}

console.log("[security-audit] OK — no critical vulnerabilities");
process.exit(0);
