import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFinikPaymentStatusRouted,
  isOfficialAcquiringStatusRoutingAllowed,
} from "../../src/server/finik/finikStatusRouter.js";
import * as legacyAdapter from "../../src/server/finik/legacyStatusAdapter.js";
import * as officialAdapter from "../../src/server/finik/officialAcquiringStatusAdapter.js";

describe("finikStatusRouter", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("routes to legacy when FINIK_CREATE_API_MODE=legacy", async () => {
    process.env.FINIK_CREATE_API_MODE = "legacy";
    const spy = vi
      .spyOn(legacyAdapter, "fetchLegacyFinikPaymentStatus")
      .mockResolvedValue({
        ok: true,
        status: "paid",
        amount: 100,
        apiMode: "legacy",
      });

    const out = await fetchFinikPaymentStatusRouted(
      {
        finikApiKey: "k",
        finikAccountId: "a",
        finikSecret: "s",
      },
      "pay-1",
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.apiMode).toBe("legacy");
  });

  it("routes to official when FINIK_CREATE_API_MODE=official", async () => {
    process.env.FINIK_CREATE_API_MODE = "official";
    expect(isOfficialAcquiringStatusRoutingAllowed()).toBe(true);

    const spy = vi
      .spyOn(officialAdapter, "fetchOfficialFinikPaymentStatus")
      .mockResolvedValue({
        ok: true,
        status: "succeeded",
        amount: 200,
        apiMode: "official",
      });

    const out = await fetchFinikPaymentStatusRouted(
      {
        finikApiKey: "k",
        finikAccountId: "acct",
        finikSecret: null,
      },
      "uuid-pay",
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.status).toBe("succeeded");
      expect(out.apiMode).toBe("official");
    }
  });

  it("auto uses official when RSA key configured", async () => {
    process.env.FINIK_CREATE_API_MODE = "auto";
    process.env.FINIK_RSA_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";

    const spy = vi
      .spyOn(officialAdapter, "fetchOfficialFinikPaymentStatus")
      .mockResolvedValue({
        ok: true,
        status: "succeeded",
        amount: null,
        apiMode: "official",
      });

    await fetchFinikPaymentStatusRouted(
      { finikApiKey: "k", finikAccountId: "a", finikSecret: null },
      "pid",
    );
    expect(spy).toHaveBeenCalled();
  });
});
