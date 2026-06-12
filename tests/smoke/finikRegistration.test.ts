import { afterEach, describe, expect, it } from "vitest";
import {
  finikRegistrationAdminLine,
  finikRegistrationComplete,
  parseFinikRegistrationFields,
} from "../../src/shared/finikRegistration.js";

describe("finikRegistration", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("skips when both fields empty", () => {
    const r = parseFinikRegistrationFields({});
    expect(r).toEqual({ ok: true, skip: true });
  });

  it("requires account when key present", () => {
    const r = parseFinikRegistrationFields({ finikApiKey: "key-1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Account ID");
  });

  it("requires key when account present", () => {
    const r = parseFinikRegistrationFields({ finikAccountId: "acct-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("API Key");
  });

  it("accepts valid pair", () => {
    const r = parseFinikRegistrationFields({
      finikApiKey: "key-1234",
      finikAccountId: "acct-5678",
    });
    expect(r).toEqual({
      ok: true,
      skip: false,
      finikApiKey: "key-1234",
      finikAccountId: "acct-5678",
    });
  });

  it("admin line reflects registration state", () => {
    expect(finikRegistrationAdminLine({})).toBe("не подключён");
    expect(
      finikRegistrationAdminLine({
        finikApiKey: "key-1234",
        finikAccountId: "acct-1",
      }),
    ).toBe("API Key + Account ID");
    expect(
      finikRegistrationAdminLine({ finikApiKey: "key-1234" }),
    ).toBe("ошибка данных");
  });

  it("complete only when pair valid", () => {
    expect(finikRegistrationComplete({ finikApiKey: "key-1234" })).toBe(false);
    expect(
      finikRegistrationComplete({
        finikApiKey: "key-1234",
        finikAccountId: "acct-5678",
      }),
    ).toBe(true);
  });

  describe("platform-managed mode", () => {
    it("accepts account id only", () => {
      process.env.FINIK_PLATFORM_MANAGED_MERCHANTS = "1";
      const r = parseFinikRegistrationFields({ finikAccountId: "acct-5678" });
      expect(r).toEqual({
        ok: true,
        skip: false,
        finikAccountId: "acct-5678",
      });
      expect(finikRegistrationAdminLine({ finikAccountId: "acct-5678" })).toBe(
        "Account ID",
      );
      expect(
        finikRegistrationComplete({ finikAccountId: "acct-5678" }),
      ).toBe(true);
    });
  });
});
