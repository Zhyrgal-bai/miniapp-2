import { describe, expect, it } from "vitest";
import {
  ARCHA_SUBSCRIPTION_PLANS,
  addCalendarMonths,
  getArchaSubscriptionPlan,
  planSpecForCode,
  subscriptionEndAfterPlan,
} from "../../src/shared/archaSubscriptionPlans.js";

describe("archaSubscriptionPlans", () => {
  it("defines MONTHLY, HALF_YEAR, YEARLY", () => {
    const codes = ARCHA_SUBSCRIPTION_PLANS.map((p) => p.code);
    expect(codes).toEqual(["MONTHLY", "HALF_YEAR", "YEARLY"]);
  });

  it("YEARLY uses 12 paid + 1 bonus calendar months", () => {
    const yearly = getArchaSubscriptionPlan("YEARLY");
    expect(yearly).not.toBeNull();
    if (!yearly) return;
    expect(yearly.paidMonths).toBe(12);
    expect(yearly.bonusMonths).toBe(1);
    const spec = planSpecForCode("YEARLY");
    expect(spec.totalMonths).toBe(13);
    expect(spec.amountSom).toBeGreaterThan(0);
  });

  it("YEARLY extends by calendar months (Jan 15 + 13 mo → Feb 15 next year)", () => {
    const start = new Date("2026-01-15T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "YEARLY");
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(15);
  });

  it("MONTHLY adds one calendar month", () => {
    const start = new Date("2026-01-31T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "MONTHLY");
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(28);
  });

  it("HALF_YEAR adds six calendar months", () => {
    const start = new Date("2026-03-10T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "HALF_YEAR");
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(10);
  });

  it("addCalendarMonths handles month-end overflow", () => {
    const d = addCalendarMonths(new Date("2026-01-31T00:00:00.000Z"), 1);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });
});
