/**
 * Generate RSA 2048 key pair for Finik integration.
 * Run: node scripts/generate-finik-keys.js
 */
import { generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privateKeyPath = path.join(projectRoot, "finik_private.pem");
const publicKeyPath = path.join(projectRoot, "finik_public.pem");

if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
  console.warn("Warning: key files already exist. Generation skipped.");
  if (existsSync(privateKeyPath)) {
    console.warn(`  - ${privateKeyPath}`);
  }
  if (existsSync(publicKeyPath)) {
    console.warn(`  - ${publicKeyPath}`);
  }
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

console.log("Finik RSA keys generated successfully.\n");
console.log(`Private key: ${privateKeyPath}`);
console.log(`Public key:  ${publicKeyPath}`);
console.log(
  "\nSend the public key (finik_public.pem) to Finik. Keep the private key secret and never commit it to git.",
);
