import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseBusinessIdFromWebAppStartParam,
  validateTelegramInitData,
} from "../../src/server/telegramWebAppInitData.js";
import { tenantBusinessIdFromRequest } from "../../src/server/tenantHintFromRequest.js";
import type { Request } from "express";

function secretKeyForWebApp(botToken: string): Buffer {
  return crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
}

function buildSignedInitData(
  botToken: string,
  fields: Record<string, string>,
): string {
  const params = new URLSearchParams(fields);
  const pairs: Array<[string, string]> = [];
  for (const key of [...new Set([...params.keys()])]) {
    if (key === "hash") continue;
    const v = params.get(key);
    if (v == null) continue;
    pairs.push([key, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  const hash = crypto
    .createHmac("sha256", secretKeyForWebApp(botToken))
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("telegram initData validation", () => {
  const storeBot = "123456789:AAStoreBotTokenForTests";
  const platformBot = "987654321:AAPlatformTemplateBotToken";

  it("validates signature with the bot that signed initData", () => {
    const initData = buildSignedInitData(storeBot, {
      user: JSON.stringify({ id: 4242, first_name: "Buyer" }),
      auth_date: "1700000000",
      start_param: "shop_7",
    });
    expect(validateTelegramInitData(initData, storeBot)).toBe(true);
    expect(validateTelegramInitData(initData, platformBot)).toBe(false);
  });

  it("validates menu-button open without start_param using platform bot", () => {
    const initData = buildSignedInitData(platformBot, {
      user: JSON.stringify({ id: 4242, first_name: "Buyer" }),
      auth_date: "1700000000",
    });
    expect(parseBusinessIdFromWebAppStartParam(initData)).toBeNull();
    expect(validateTelegramInitData(initData, platformBot)).toBe(true);
    expect(validateTelegramInitData(initData, storeBot)).toBe(false);
  });

  it("parses shop_<id> start_param", () => {
    const initData = buildSignedInitData(storeBot, {
      user: JSON.stringify({ id: 1 }),
      auth_date: "1",
      start_param: "shop_42",
    });
    expect(parseBusinessIdFromWebAppStartParam(initData)).toBe(42);
  });
});

describe("tenant hint from request (checkout x-business-id)", () => {
  it("reads x-business-id header", () => {
    const req = {
      query: {},
      headers: { "x-business-id": "15" },
      body: {},
    } as unknown as Request;
    expect(tenantBusinessIdFromRequest(req)).toBe(15);
  });

  it("prefers query businessId over header", () => {
    const req = {
      query: { businessId: "9" },
      headers: { "x-business-id": "15" },
      body: {},
    } as unknown as Request;
    expect(tenantBusinessIdFromRequest(req)).toBe(9);
  });

  it("reads body.businessId for POST /orders", () => {
    const req = {
      query: {},
      headers: {},
      body: { businessId: 33, shop: "33" },
    } as unknown as Request;
    expect(tenantBusinessIdFromRequest(req)).toBe(33);
  });
});
