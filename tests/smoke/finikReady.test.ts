import { describe, expect, it } from "vitest";
import {
  buildFinikWebhookUrl,
  isFinikCredentialsReady,
  isFinikUseMockEnabled,
} from "../../src/shared/finikReady.js";

describe("finikReady", () => {
  it("requires api key and secret when mock is off", () => {
    const prev = process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_USE_MOCK;
    expect(isFinikCredentialsReady("key-1234", "secret-5678")).toBe(true);
    expect(isFinikCredentialsReady("key-1234", null)).toBe(false);
    expect(isFinikCredentialsReady(null, "secret-5678")).toBe(false);
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

  it("builds webhook url from origin and business id", () => {
    expect(buildFinikWebhookUrl("https://api.example.com/", 42)).toBe(
      "https://api.example.com/finik/webhook/42",
    );
    expect(buildFinikWebhookUrl("", 1)).toBeNull();
  });
});
