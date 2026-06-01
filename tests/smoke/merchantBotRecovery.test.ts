import { describe, expect, it } from "vitest";
import { classifyMerchantBotRecovery } from "../../src/server/merchantBotRecoveryService.js";

describe("classifyMerchantBotRecovery", () => {
  it("reports connected when token and webhook OK", () => {
    const r = classifyMerchantBotRecovery({
      token: { kind: "ok", token: "123:abc" },
      getMeOk: true,
      getMeError: null,
      webhookStatus: "OK",
      webhookLastError: null,
      publicApiConfigured: true,
    });
    expect(r.status).toBe("connected");
    expect(r.label).toBe("Подключён");
  });

  it("reports webhook_error when Telegram webhook fails", () => {
    const r = classifyMerchantBotRecovery({
      token: { kind: "ok", token: "123:abc" },
      getMeOk: true,
      getMeError: null,
      webhookStatus: "ERROR",
      webhookLastError: "Wrong response code",
      publicApiConfigured: true,
    });
    expect(r.status).toBe("webhook_error");
    expect(r.detail).toContain("Wrong response");
  });

  it("reports token_error when getMe fails", () => {
    const r = classifyMerchantBotRecovery({
      token: { kind: "ok", token: "bad" },
      getMeOk: false,
      getMeError: "Unauthorized",
      webhookStatus: "skipped",
      webhookLastError: null,
      publicApiConfigured: true,
    });
    expect(r.status).toBe("token_error");
  });

  it("reports not_configured when token missing", () => {
    const r = classifyMerchantBotRecovery({
      token: { kind: "missing" },
      getMeOk: false,
      getMeError: null,
      webhookStatus: "skipped",
      webhookLastError: null,
      publicApiConfigured: true,
    });
    expect(r.status).toBe("not_configured");
  });
});
