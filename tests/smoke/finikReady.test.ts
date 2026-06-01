import { describe, expect, it } from "vitest";
import {
  buildFinikWebhookUrl,
  finikUseMockForBusiness,
  isFinikCredentialsReady,
  isFinikLegacyHttpReady,
  isFinikUseMockEnabled,
} from "../../src/shared/finikReady.js";

describe("finikReady", () => {
  it("requires api key and account id when mock is off", () => {
    const prev = process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_USE_MOCK;
    expect(isFinikCredentialsReady("key-1234", "acct-5678")).toBe(true);
    expect(isFinikCredentialsReady("key-1234", null)).toBe(false);
    expect(isFinikCredentialsReady(null, "acct-5678")).toBe(false);
    if (prev !== undefined) process.env.FINIK_USE_MOCK = prev;
  });

  it("legacy http requires api key and secret when mock is off", () => {
    const prev = process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_USE_MOCK;
    expect(isFinikLegacyHttpReady("key-1234", "secret-5678")).toBe(true);
    expect(isFinikLegacyHttpReady("key-1234", null)).toBe(false);
    if (prev !== undefined) process.env.FINIK_USE_MOCK = prev;
  });

  it("mock mode marks credentials ready without keys", () => {
    const prev = process.env.FINIK_USE_MOCK;
    process.env.FINIK_USE_MOCK = "1";
    expect(isFinikUseMockEnabled()).toBe(true);
    expect(isFinikCredentialsReady(null, null)).toBe(true);
    if (prev !== undefined) process.env.FINIK_USE_MOCK = prev;
    else delete process.env.FINIK_USE_MOCK;
  });

  it("mock gate uses account id not secret", () => {
    const prev = process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_USE_MOCK;
    expect(
      finikUseMockForBusiness({
        finikApiKey: "k",
        finikAccountId: "a",
      }),
    ).toBe(false);
    expect(
      finikUseMockForBusiness({
        finikApiKey: "k",
        finikAccountId: null,
      }),
    ).toBe(true);
    expect(
      finikUseMockForBusiness({
        finikApiKey: "k",
        finikAccountId: "a",
        finikSecret: null,
      } as { finikApiKey: string; finikAccountId: string }),
    ).toBe(false);
    if (prev !== undefined) process.env.FINIK_USE_MOCK = prev;
  });

  it("builds webhook url from origin and business id", () => {
    expect(buildFinikWebhookUrl("https://api.example.com/", 42)).toBe(
      "https://api.example.com/finik/webhook/42",
    );
    expect(buildFinikWebhookUrl("", 1)).toBeNull();
  });
});
