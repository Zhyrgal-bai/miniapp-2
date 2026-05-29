import { describe, expect, it } from "vitest";
import {
  preorderGuestLabel,
  preorderGuestStatusFromOrders,
} from "../../src/shared/reservationPreorder.js";

describe("reservation preorder guest status", () => {
  it("maps paid preorder", () => {
    expect(
      preorderGuestStatusFromOrders(["PREORDER_PAYMENT_PENDING", "PREORDER_PAID"]),
    ).toBe("paid");
    expect(preorderGuestLabel("paid")).toBe("Оплачен");
  });

  it("maps pending preorder", () => {
    expect(preorderGuestStatusFromOrders(["PREORDER_DRAFT"])).toBe("pending");
    expect(preorderGuestStatusFromOrders(["PREORDER_PAYMENT_PENDING"])).toBe("pending");
    expect(preorderGuestLabel("pending")).toBe("Ожидает оплату");
  });

  it("maps no active preorder", () => {
    expect(preorderGuestStatusFromOrders(["PREORDER_CANCELLED"])).toBe("none");
    expect(preorderGuestLabel("none")).toBe("Нет предзаказа");
  });
});
