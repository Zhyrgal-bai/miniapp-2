import { describe, expect, it } from "vitest";
import {
  customerOrderActions,
  orderCommercePhase,
  orderIsPaid,
} from "../../src/shared/orderCommerce.js";
import { orderFingerprint } from "../../src/server/abuseGuardService.js";
import {
  finikPaymentStateView,
  finikOrderIsAwaitingPayment,
} from "../../src/shared/finikPaymentState.js";
import { deliveryTimelineSteps } from "../../src/shared/delivery.js";
import { requestTimelineSteps } from "../../src/shared/orderRequestLabels.js";

describe("order lifecycle mapping (DB → UX phases)", () => {
  it("maps NEW → BEFORE_PAYMENT", () => {
    expect(orderCommercePhase("NEW")).toBe("BEFORE_PAYMENT");
    expect(finikOrderIsAwaitingPayment("NEW")).toBe(true);
  });

  it("maps PAID_PENDING → BEFORE_PAYMENT (awaiting Finik webhook)", () => {
    expect(orderCommercePhase("PAID_PENDING")).toBe("BEFORE_PAYMENT");
  });

  it("maps CONFIRMED → PAID_IN_FULFILLMENT", () => {
    expect(orderCommercePhase("CONFIRMED")).toBe("PAID_IN_FULFILLMENT");
    expect(orderIsPaid("CONFIRMED")).toBe(true);
  });

  it("maps SHIPPED → SHIPPING", () => {
    expect(orderCommercePhase("SHIPPED")).toBe("SHIPPING");
  });

  it("maps DELIVERED → DELIVERED with return actions", () => {
    expect(orderCommercePhase("DELIVERED")).toBe("DELIVERED");
    const actions = customerOrderActions(orderCommercePhase("DELIVERED"));
    expect(actions.some((a) => a.kind === "return")).toBe(true);
  });
});

describe("Finik payment states", () => {
  it("paid order shows paid state", () => {
    const v = finikPaymentStateView({
      orderStatus: "CONFIRMED",
      paymentMethod: "finik",
    });
    expect(v?.key).toBe("paid");
  });

  it("duplicate webhook safe — already paid", () => {
    const v = finikPaymentStateView({
      orderStatus: "CONFIRMED",
      paymentMethod: "finik",
      polling: true,
    });
    expect(v?.key).toBe("paid");
  });

  it("closed window / timeout shows expired hint", () => {
    const v = finikPaymentStateView({
      orderStatus: "NEW",
      paymentMethod: "finik",
      timedOut: true,
    });
    expect(v?.key).toBe("expired");
  });

  it("cancelled payment shows failed", () => {
    const v = finikPaymentStateView({
      orderStatus: "CANCELLED",
      paymentMethod: "finik",
    });
    expect(v?.key).toBe("failed");
  });
});

describe("support flows — action eligibility", () => {
  it("cancel only before payment", () => {
    const before = customerOrderActions("BEFORE_PAYMENT");
    expect(before.some((a) => a.kind === "cancel")).toBe(true);
    expect(before.some((a) => a.kind === "refund")).toBe(false);
  });

  it("refund after payment, before delivery", () => {
    const paid = customerOrderActions("PAID_IN_FULFILLMENT");
    expect(paid.some((a) => a.kind === "refund")).toBe(true);
    expect(paid.some((a) => a.kind === "return")).toBe(false);
  });

  it("return only after delivery", () => {
    const del = customerOrderActions("DELIVERED");
    expect(del.some((a) => a.kind === "return")).toBe(true);
    expect(del.some((a) => a.kind === "refund")).toBe(false);
  });
});

describe("abuse — duplicate order fingerprint", () => {
  it("same cart produces same fingerprint", () => {
    const items = [{ productId: 1, size: "M", color: "Black", quantity: 2 }];
    const a = orderFingerprint(items);
    const b = orderFingerprint([...items]);
    expect(a).toBe(b);
  });

  it("different qty produces different fingerprint", () => {
    const a = orderFingerprint([
      { productId: 1, size: "M", color: "Black", quantity: 1 },
    ]);
    const b = orderFingerprint([
      { productId: 1, size: "M", color: "Black", quantity: 2 },
    ]);
    expect(a).not.toBe(b);
  });
});

describe("delivery timeline", () => {
  it("shows courier steps for delivery mode", () => {
    const steps = deliveryTimelineSteps({
      deliveryMode: "DELIVERY",
      deliveryStage: "OUT_FOR_DELIVERY",
      orderStatus: "SHIPPED",
    });
    expect(steps.length).toBeGreaterThan(2);
    expect(steps.some((s) => s.label.includes("Курьер"))).toBe(true);
  });
});

describe("request timelines", () => {
  it("cancel timeline ends approved or rejected", () => {
    const steps = requestTimelineSteps("cancel", "APPROVED");
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it("refund timeline tracks REFUNDED", () => {
    const steps = requestTimelineSteps("refund", "REFUNDED");
    expect(steps.some((s) => s.label.includes("Заявка"))).toBe(true);
  });
});
