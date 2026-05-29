import { describe, expect, it } from "vitest";
import {
  DEPOSIT_PAYMENT_TIMEOUT_MINUTES,
  parseReservationDepositExternalId,
  parseReservationDepositSettings,
  reservationDepositExternalId,
  reservationDepositLabel,
  isReservationDepositBlockingPreorder,
} from "../../src/shared/reservationDeposit.js";
import { computeDepositDueAt } from "../../src/server/tableReservationDeposit.js";

describe("reservation deposit settings", () => {
  it("parses disabled by default", () => {
    expect(parseReservationDepositSettings({})).toEqual({
      enabled: false,
      amountSom: 500,
    });
  });

  it("parses enabled deposit amount", () => {
    expect(
      parseReservationDepositSettings({
        reservationDepositEnabled: true,
        reservationDepositAmountSom: 1000,
      }),
    ).toEqual({ enabled: true, amountSom: 1000 });
  });

  it("labels deposit statuses for admin UI", () => {
    expect(reservationDepositLabel("NONE")).toBe("Не требуется");
    expect(reservationDepositLabel("DEPOSIT_PENDING")).toBe("Ожидает оплату");
    expect(reservationDepositLabel("DEPOSIT_PAID")).toBe("Оплачен");
  });
});

describe("reservation deposit payment ids", () => {
  it("round-trips external id", () => {
    const ext = reservationDepositExternalId(42);
    expect(ext).toBe("res_deposit:42");
    expect(parseReservationDepositExternalId(ext)).toBe(42);
  });
});

describe("reservation deposit preorder gate", () => {
  it("blocks preorder until deposit paid", () => {
    expect(isReservationDepositBlockingPreorder("DEPOSIT_PENDING")).toBe(true);
    expect(isReservationDepositBlockingPreorder("DEPOSIT_EXPIRED")).toBe(true);
    expect(isReservationDepositBlockingPreorder("DEPOSIT_PAID")).toBe(false);
    expect(isReservationDepositBlockingPreorder("NONE")).toBe(false);
  });
});

describe("reservation deposit timeout", () => {
  it("uses 15 minute payment window", () => {
    expect(DEPOSIT_PAYMENT_TIMEOUT_MINUTES).toBe(15);
    const now = new Date("2026-06-28T12:00:00.000Z");
    expect(computeDepositDueAt(now).toISOString()).toBe("2026-06-28T12:15:00.000Z");
  });
});
