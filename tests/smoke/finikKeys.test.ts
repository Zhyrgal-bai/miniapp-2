import { afterEach, describe, expect, it } from "vitest";
import {
  getFinikAccountId,
  getFinikApiKey,
  getFinikOfficialEnvLoadStatus,
  getFinikPrivateKey,
  getFinikPublicKey,
  isFinikOfficialEnvComplete,
  reloadFinikKeysFromEnv,
  validateFinikOfficialEnvKeys,
} from "../../src/server/finik/finikKeys.js";

const ENV_KEYS = [
  "FINIK_PRIVATE_KEY",
  "FINIK_PUBLIC_KEY",
  "FINIK_API_KEY",
  "FINIK_ACCOUNT_ID",
] as const;

function clearFinikEnv(): void {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

describe("finikKeys", () => {
  afterEach(() => {
    clearFinikEnv();
    reloadFinikKeysFromEnv();
  });

  it("returns empty getters when env is unset", () => {
    clearFinikEnv();
    reloadFinikKeysFromEnv();
    expect(getFinikPrivateKey()).toBe("");
    expect(getFinikPublicKey()).toBe("");
    expect(getFinikApiKey()).toBe("");
    expect(getFinikAccountId()).toBe("");
    expect(isFinikOfficialEnvComplete()).toBe(false);
    expect(validateFinikOfficialEnvKeys().length).toBeGreaterThan(0);
  });

  it("normalizes PEM with escaped newlines", () => {
    process.env.FINIK_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----";
    process.env.FINIK_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\\nXYZ\\n-----END PUBLIC KEY-----";
    process.env.FINIK_API_KEY = "  test-api-key  ";
    process.env.FINIK_ACCOUNT_ID = "acc-123";
    reloadFinikKeysFromEnv();
    expect(getFinikPrivateKey()).toContain("\nABC\n");
    expect(getFinikPublicKey()).toContain("\nXYZ\n");
    expect(getFinikApiKey()).toBe("test-api-key");
    expect(getFinikAccountId()).toBe("acc-123");
    expect(isFinikOfficialEnvComplete()).toBe(true);
    expect(validateFinikOfficialEnvKeys()).toEqual([]);
    const status = getFinikOfficialEnvLoadStatus();
    expect(Object.values(status).every(Boolean)).toBe(true);
  });

  it("warns when only partial env is set", () => {
    process.env.FINIK_API_KEY = "only-key";
    reloadFinikKeysFromEnv();
    const warnings = validateFinikOfficialEnvKeys();
    expect(warnings.some((w) => w.includes("incomplete"))).toBe(true);
    expect(isFinikOfficialEnvComplete()).toBe(false);
  });
});
