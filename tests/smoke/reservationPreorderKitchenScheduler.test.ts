import { describe, expect, it } from "vitest";
import {
  computeKitchenPrepAt,
  DEFAULT_PRODUCT_PREP_MINUTES,
  formatMinutesUntil,
} from "../../src/server/reservationPreorderKitchenScheduler.js";

describe("reservation preorder kitchen scheduler", () => {
  it("computes kitchenPrepAt as reservedAt minus max prep minutes", () => {
    const reservedAt = new Date("2026-06-28T19:00:00.000Z");
    const now = new Date("2026-06-28T10:00:00.000Z");
    const at = computeKitchenPrepAt(reservedAt, 20, now);
    expect(at.toISOString()).toBe("2026-06-28T18:40:00.000Z");
  });

  it("starts immediately when prep window already passed", () => {
    const reservedAt = new Date("2026-06-28T19:00:00.000Z");
    const now = new Date("2026-06-28T18:50:00.000Z");
    const at = computeKitchenPrepAt(reservedAt, 20, now);
    expect(at.getTime()).toBe(now.getTime());
  });

  it("uses at least 1 minute prep window", () => {
    const reservedAt = new Date("2026-06-28T19:00:00.000Z");
    const now = new Date("2026-06-28T10:00:00.000Z");
    const at = computeKitchenPrepAt(reservedAt, 0, now);
    expect(at.toISOString()).toBe("2026-06-28T18:59:00.000Z");
  });

  it("formats minutes until kitchen start", () => {
    const now = new Date("2026-06-28T18:00:00.000Z");
    expect(formatMinutesUntil("2026-06-28T18:40:00.000Z", now)).toBe("через 40 мин");
    expect(formatMinutesUntil("2026-06-28T18:00:30.000Z", now)).toBe("через 1 мин");
    expect(formatMinutesUntil("2026-06-28T18:00:00.000Z", now)).toBe("сейчас");
    expect(formatMinutesUntil("2026-06-28T19:30:00.000Z", now)).toBe("через 1 ч 30 мин");
  });

  it("has sensible default prep minutes", () => {
    expect(DEFAULT_PRODUCT_PREP_MINUTES).toBeGreaterThan(0);
  });
});
