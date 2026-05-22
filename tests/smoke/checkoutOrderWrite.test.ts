import { describe, expect, it } from "vitest";
import { DeliveryMode } from "@prisma/client";
import {
  buildCheckoutOrderItemRows,
  coerceCheckoutOrderTotal,
  coercePositiveInt,
  orderOptionsToJson,
  parseCheckoutDeliveryMode,
} from "../../src/server/checkoutOrderWrite.js";

describe("checkoutOrderWrite", () => {
  it("coercePositiveInt rejects NaN and non-integers", () => {
    expect(coercePositiveInt(1)).toBe(1);
    expect(coercePositiveInt(1.2)).toBe(1);
    expect(coercePositiveInt(Number.NaN)).toBeNull();
    expect(coercePositiveInt("x")).toBeNull();
    expect(coercePositiveInt(0)).toBeNull();
  });

  it("orderOptionsToJson strips undefined and serializes values", () => {
    const j = orderOptionsToJson({
      packaging: "paper",
      skip: undefined,
      n: 2,
      ok: true,
    });
    expect(j).toEqual({ packaging: "paper", n: 2, ok: true });
  });

  it("buildCheckoutOrderItemRows produces integer quantity and price", () => {
    const rows = buildCheckoutOrderItemRows(
      10,
      [
        {
          productId: 5,
          name: "RED rozes",
          size: "11",
          color: "",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
      [{ packaging: "paper" }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.quantity).toBe(1);
    expect(rows[0]!.price).toBe(5000);
    expect(rows[0]!.options).toEqual({ packaging: "paper" });
  });

  it("omits options field when validated options are empty", () => {
    const rows = buildCheckoutOrderItemRows(
      10,
      [
        {
          productId: 5,
          name: "RED rozes",
          size: "11",
          color: "",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
      [{}],
    );
    expect(rows[0]!.options).toBeUndefined();
  });

  it("coerceCheckoutOrderTotal rounds floats", () => {
    expect(coerceCheckoutOrderTotal(5000.7)).toBe(5001);
    expect(() => coerceCheckoutOrderTotal(Number.NaN)).toThrow("INVALID_ITEM");
  });

  it("parseCheckoutDeliveryMode reads deliveryType from storefront", () => {
    expect(parseCheckoutDeliveryMode({ deliveryType: "pickup" })).toBe(
      DeliveryMode.PICKUP,
    );
    expect(parseCheckoutDeliveryMode({ deliveryType: "delivery" })).toBe(
      DeliveryMode.DELIVERY,
    );
  });
});
