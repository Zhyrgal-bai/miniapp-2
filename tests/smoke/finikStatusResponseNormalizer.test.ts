import { describe, expect, it } from "vitest";
import { normalizeFinikPaymentStatusResponse } from "../../src/server/finik/finikStatusResponseNormalizer.js";

describe("normalizeFinikPaymentStatusResponse", () => {
  it("maps official SUCCEEDED and amount", () => {
    const out = normalizeFinikPaymentStatusResponse({
      status: "SUCCEEDED",
      amount: 150,
      transactionId: "tx-1",
    });
    expect(out.status).toBe("succeeded");
    expect(out.amount).toBe(150);
  });

  it("reads amount from fields", () => {
    const out = normalizeFinikPaymentStatusResponse({
      status: "FAILED",
      fields: { amount: 99 },
    });
    expect(out.status).toBe("failed");
    expect(out.amount).toBe(99);
  });
});
