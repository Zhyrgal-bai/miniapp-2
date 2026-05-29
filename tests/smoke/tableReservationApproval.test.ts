import { describe, expect, it } from "vitest";
import { parseTableReservationCallbackData } from "../../src/bot/tableReservationCallbacks.js";

describe("table reservation approval callbacks", () => {
  it("parses confirm callback_data", () => {
    expect(parseTableReservationCallbackData("reservation_confirm_42")).toEqual({
      action: "confirm",
      reservationId: 42,
    });
  });

  it("parses reject callback_data", () => {
    expect(parseTableReservationCallbackData("reservation_reject_99")).toEqual({
      action: "reject",
      reservationId: 99,
    });
  });

  it("ignores unrelated callback_data", () => {
    expect(parseTableReservationCallbackData("accept_1")).toBeNull();
    expect(parseTableReservationCallbackData("reservation_confirm_0")).toBeNull();
    expect(parseTableReservationCallbackData("reservation_confirm_abc")).toBeNull();
  });
});
