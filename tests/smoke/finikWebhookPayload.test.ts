import { describe, expect, it } from "vitest";
import {
  extractFinikWebhookPaymentIds,
  parseFinikWebhookPayload,
} from "../../src/server/finik/finikWebhookPayload.js";

describe("finikWebhookPayload", () => {
  it("extracts official and legacy payment id fields", () => {
    const ids = extractFinikWebhookPaymentIds({
      id: "tx-credit-1",
      transactionId: "tx-241234",
      payment_id: "legacy-pay",
    });
    expect(ids).toEqual(["legacy-pay", "tx-241234", "tx-credit-1"]);
  });

  it("parses SUCCEEDED as succeeded for success set", () => {
    const p = parseFinikWebhookPayload({
      transactionId: "tx-1",
      status: "SUCCEEDED",
      amount: 500,
      external_id: "7:99",
    });
    expect(p.paymentId).toBe("tx-1");
    expect(p.status).toBe("succeeded");
    expect(p.externalId).toBe("7:99");
    expect(p.amount).toBe(500);
  });

  it("parses official nested Data.externalId for order correlation", () => {
    const p = parseFinikWebhookPayload({
      transactionId: "finik-tx-99",
      Status: "SUCCEEDED",
      Amount: 1200,
      Data: {
        externalId: "5:42",
        accountId: "merchant-acct",
      },
    });
    expect(p.paymentId).toBe("finik-tx-99");
    expect(p.status).toBe("succeeded");
    expect(p.externalId).toBe("5:42");
    expect(p.amount).toBe(1200);
  });
});
