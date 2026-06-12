import { describe, expect, it } from "vitest";
import {
  finikExternalId,
  isRefundEligibleOrderStatus,
  parseRefundMethod,
  validateRefundAmount,
} from "../../src/shared/refundValidation.js";
import { resolveRefundCompletion } from "../../src/server/refund/refundCompletion.js";
import { tryFinikRefund, isFinikRefundAvailable } from "../../src/server/refund/finikRefundAdapter.js";

describe("refund amount validation (P1)", () => {
  it("accepts full order total", () => {
    const r = validateRefundAmount(1500, 1500);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toBe(1500);
  });

  it("accepts partial amount", () => {
    const r = validateRefundAmount(500, 1500);
    expect(r.ok).toBe(true);
  });

  it("rejects zero", () => {
    const r = validateRefundAmount(0, 1500);
    expect(r.ok).toBe(false);
  });

  it("rejects negative", () => {
    const r = validateRefundAmount(-1, 1500);
    expect(r.ok).toBe(false);
  });

  it("rejects above order total", () => {
    const r = validateRefundAmount(1501, 1500);
    expect(r.ok).toBe(false);
  });

  it("rejects non-integer", () => {
    const r = validateRefundAmount(10.5, 1500);
    expect(r.ok).toBe(false);
  });

  it("rejects null amount", () => {
    expect(validateRefundAmount(null, 1500).ok).toBe(false);
  });
});

describe("refund eligibility helpers", () => {
  it("allows CONFIRMED and SHIPPED only", () => {
    expect(isRefundEligibleOrderStatus("CONFIRMED")).toBe(true);
    expect(isRefundEligibleOrderStatus("SHIPPED")).toBe(true);
    expect(isRefundEligibleOrderStatus("DELIVERED")).toBe(false);
    expect(isRefundEligibleOrderStatus("CANCELLED")).toBe(false);
    expect(isRefundEligibleOrderStatus("NEW")).toBe(false);
  });

  it("parses refund methods", () => {
    expect(parseRefundMethod("manual")).toBe("MANUAL");
    expect(parseRefundMethod("FINIK")).toBe("FINIK");
    expect(parseRefundMethod("auto")).toBe("AUTO");
    expect(parseRefundMethod("wire")).toBe(null);
  });

  it("builds finik external id", () => {
    expect(finikExternalId(3, 42)).toBe("3:42");
  });
});

describe("refund completion — manual vs Finik scaffold", () => {
  it("MANUAL requires merchant note", async () => {
    const r = await resolveRefundCompletion({
      businessId: 1,
      orderId: 2,
      paymentReference: "pay-1",
      orderPaymentId: "pay-1",
      amountSom: 100,
      methodWire: "MANUAL",
      merchantComment: "",
    });
    expect(r.ok).toBe(false);
  });

  it("MANUAL succeeds with note", async () => {
    const r = await resolveRefundCompletion({
      businessId: 1,
      orderId: 2,
      paymentReference: "pay-1",
      orderPaymentId: null,
      amountSom: 100,
      methodWire: "MANUAL",
      merchantComment: "Возврат через банк",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.refundMethod).toBe("MANUAL");
  });

  it("FINIK fails when adapter unavailable", async () => {
    expect(isFinikRefundAvailable()).toBe(false);
    const finik = await tryFinikRefund({
      businessId: 1,
      orderId: 2,
      paymentReference: "x",
      amountSom: 100,
    });
    expect(finik.ok).toBe(false);

    const r = await resolveRefundCompletion({
      businessId: 1,
      orderId: 2,
      paymentReference: "x",
      orderPaymentId: null,
      amountSom: 100,
      methodWire: "FINIK",
      merchantComment: "note",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusCode).toBe(502);
  });

  it("AUTO falls back to MANUAL with note when Finik unavailable", async () => {
    const r = await resolveRefundCompletion({
      businessId: 1,
      orderId: 2,
      paymentReference: "x",
      orderPaymentId: null,
      amountSom: 100,
      methodWire: "AUTO",
      merchantComment: "Ручной возврат после проверки",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.refundMethod).toBe("MANUAL");
  });

  it("AUTO requires note when Finik unavailable", async () => {
    const r = await resolveRefundCompletion({
      businessId: 1,
      orderId: 2,
      paymentReference: null,
      orderPaymentId: null,
      amountSom: 50,
      methodWire: "AUTO",
      merchantComment: null,
    });
    expect(r.ok).toBe(false);
  });
});

describe("backward compatibility — legacy rows without refundMethod", () => {
  it("null refundMethod on wire is allowed (optional on patch)", () => {
    expect(parseRefundMethod(undefined)).toBe(null);
  });
});
