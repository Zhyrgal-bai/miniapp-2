/**
 * Official Finik API — platform test credentials from Render ENV only.
 * Not used by checkout, legacy HTTP, webhooks, or merchant DB fields.
 */

export type FinikOfficialEnvKeyName =
  | "FINIK_PRIVATE_KEY"
  | "FINIK_PUBLIC_KEY"
  | "FINIK_API_KEY"
  | "FINIK_ACCOUNT_ID";

type FinikKeysSnapshot = {
  privateKey: string;
  publicKey: string;
  apiKey: string;
  accountId: string;
};

let loaded = false;
let snapshot: FinikKeysSnapshot = {
  privateKey: "",
  publicKey: "",
  apiKey: "",
  accountId: "",
};

/** PEM in Render often uses literal `\\n` in a single-line secret. */
function normalizeEnvPem(raw: string | undefined): string {
  const v = raw?.trim() ?? "";
  if (v === "") return "";
  return v.replace(/\\n/g, "\n");
}

function normalizeEnvScalar(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

/** Read FINIK_* from process.env (idempotent). Call at server startup. */
export function reloadFinikKeysFromEnv(): void {
  snapshot = {
    privateKey: normalizeEnvPem(process.env.FINIK_PRIVATE_KEY),
    publicKey: normalizeEnvPem(process.env.FINIK_PUBLIC_KEY),
    apiKey: normalizeEnvScalar(process.env.FINIK_API_KEY),
    accountId: normalizeEnvScalar(process.env.FINIK_ACCOUNT_ID),
  };
  loaded = true;
}

function ensureLoaded(): void {
  if (!loaded) reloadFinikKeysFromEnv();
}

export function getFinikPrivateKey(): string {
  ensureLoaded();
  return snapshot.privateKey;
}

export function getFinikPublicKey(): string {
  ensureLoaded();
  return snapshot.publicKey;
}

export function getFinikApiKey(): string {
  ensureLoaded();
  return snapshot.apiKey;
}

export function getFinikAccountId(): string {
  ensureLoaded();
  return snapshot.accountId;
}

export function isFinikOfficialEnvComplete(): boolean {
  ensureLoaded();
  return (
    snapshot.privateKey !== "" &&
    snapshot.publicKey !== "" &&
    snapshot.apiKey !== "" &&
    snapshot.accountId !== ""
  );
}

export function getFinikOfficialEnvLoadStatus(): Record<
  FinikOfficialEnvKeyName,
  boolean
> {
  ensureLoaded();
  return {
    FINIK_PRIVATE_KEY: snapshot.privateKey !== "",
    FINIK_PUBLIC_KEY: snapshot.publicKey !== "",
    FINIK_API_KEY: snapshot.apiKey !== "",
    FINIK_ACCOUNT_ID: snapshot.accountId !== "",
  };
}

/** Warnings only — never fails startup. */
export function validateFinikOfficialEnvKeys(): string[] {
  ensureLoaded();
  const status = getFinikOfficialEnvLoadStatus();
  const any = Object.values(status).some(Boolean);
  const all = Object.values(status).every(Boolean);

  if (!any) {
    return [
      "Official Finik test credentials not configured (FINIK_PRIVATE_KEY, FINIK_PUBLIC_KEY, FINIK_API_KEY, FINIK_ACCOUNT_ID) — Official Acquiring smoke test disabled",
    ];
  }
  if (!all) {
    const missing = (
      Object.entries(status) as [FinikOfficialEnvKeyName, boolean][]
    )
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    return [
      `Official Finik test credentials incomplete — missing: ${missing.join(", ")}`,
    ];
  }
  return [];
}

/** Logs which keys are present — never logs secret values. */
export function logFinikOfficialEnvKeysLoadStatus(): void {
  ensureLoaded();
  const status = getFinikOfficialEnvLoadStatus();
  const complete = isFinikOfficialEnvComplete();
  const parts = (
    Object.entries(status) as [FinikOfficialEnvKeyName, boolean][]
  ).map(([name, ok]) => `${name}=${ok ? "loaded" : "missing"}`);
  console.log(
    `[finik-keys] Official Finik ENV: complete=${complete} ${parts.join(" ")}`,
  );
}
