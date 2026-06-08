import { describe, expect, it } from "vitest";
import {
  ARCHA_SUBSCRIPTION_PLANS,
  addCalendarDays,
  addCalendarMonths,
  getArchaSubscriptionPlan,
  isFirstMonthPlanEligible,
  merchantVisibleSubscriptionPlans,
  planSpecForCode,
  resolveSubscriptionExtensionBaseStart,
  subscriptionEndAfterPlan,
} from "../../src/shared/archaSubscriptionPlans.js";

describe("archaSubscriptionPlans", () => {
  it("defines FIRST_MONTH, MONTHLY, THREE_MONTH, HALF_YEAR, YEARLY", () => {
    const codes = ARCHA_SUBSCRIPTION_PLANS.map((p) => p.code);
    expect(codes).toEqual([
      "FIRST_MONTH",
      "MONTHLY",
      "THREE_MONTH",
      "HALF_YEAR",
      "YEARLY",
    ]);
  });

  it("FIRST_MONTH promo is 1500 som for one calendar month", () => {
    const first = getArchaSubscriptionPlan("FIRST_MONTH");
    expect(first).not.toBeNull();
    if (!first) return;
    expect(first.amountSom).toBe(1500);
    expect(first.paidMonths).toBe(1);
    const spec = planSpecForCode("FIRST_MONTH");
    expect(spec.amountSom).toBe(1500);
  });

  it("MONTHLY is 5500 som", () => {
    const monthly = getArchaSubscriptionPlan("MONTHLY");
    expect(monthly?.amountSom).toBe(5500);
  });

  it("THREE_MONTH is 15675 som with +15 bonus days", () => {
    const three = getArchaSubscriptionPlan("THREE_MONTH");
    expect(three).not.toBeNull();
    if (!three) return;
    expect(three.amountSom).toBe(15675);
    expect(three.paidMonths).toBe(3);
    expect(three.bonusDays).toBe(15);
    expect(three.popular).toBe(true);

    const start = new Date("2026-06-01T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "THREE_MONTH");
    const afterThreeMonths = addCalendarMonths(start, 3);
    expect(end.getTime()).toBe(addCalendarDays(afterThreeMonths, 15).getTime());
  });

  it("YEARLY is 52800 som with 12 paid + 2 bonus months", () => {
    const yearly = getArchaSubscriptionPlan("YEARLY");
    expect(yearly).not.toBeNull();
    if (!yearly) return;
    expect(yearly.amountSom).toBe(52800);
    expect(yearly.paidMonths).toBe(12);
    expect(yearly.bonusMonths).toBe(2);
    const spec = planSpecForCode("YEARLY");
    expect(spec.totalMonths).toBe(14);
  });

  it("YEARLY extends by 14 calendar months", () => {
    const start = new Date("2026-01-15T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "YEARLY");
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(15);
  });

  it("MONTHLY adds one calendar month", () => {
    const start = new Date("2026-01-31T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "MONTHLY");
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(28);
  });

  it("HALF_YEAR adds six calendar months (legacy)", () => {
    const start = new Date("2026-03-10T12:00:00.000Z");
    const end = subscriptionEndAfterPlan(start, "HALF_YEAR");
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(10);
  });

  it("merchantVisibleSubscriptionPlans shows 4 plans before first payment", () => {
    const firstEligible = merchantVisibleSubscriptionPlans({
      firstMonthEligible: true,
    }).map((p) => p.code);
    expect(firstEligible).toEqual([
      "FIRST_MONTH",
      "MONTHLY",
      "THREE_MONTH",
      "YEARLY",
    ]);
  });

  it("merchantVisibleSubscriptionPlans hides FIRST_MONTH after first payment", () => {
    const renew = merchantVisibleSubscriptionPlans({
      firstMonthEligible: false,
    }).map((p) => p.code);
    expect(renew).toEqual(["MONTHLY", "THREE_MONTH", "YEARLY"]);
  });

  it("merchantVisibleSubscriptionPlans never shows HALF_YEAR", () => {
    for (const firstMonthEligible of [true, false]) {
      const codes = merchantVisibleSubscriptionPlans({
        firstMonthEligible,
      }).map((p) => p.code);
      expect(codes).not.toContain("HALF_YEAR");
    }
  });

  it("isFirstMonthPlanEligible requires no completed Finik payments", () => {
    expect(isFirstMonthPlanEligible(false)).toBe(true);
    expect(isFirstMonthPlanEligible(true)).toBe(false);
  });

  it("resolveSubscriptionExtensionBaseStart stacks from trialEndsAt on trial", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const trialEndsAt = new Date("2026-06-11T12:00:00.000Z");
    const base = resolveSubscriptionExtensionBaseStart({
      now,
      subscriptionEndsAt: null,
      subscriptionStatus: "TRIALING",
      trialEndsAt,
    });
    expect(base.getTime()).toBe(trialEndsAt.getTime());
  });

  it("resolveSubscriptionExtensionBaseStart stacks from subscriptionEndsAt when active", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const subscriptionEndsAt = new Date("2026-07-01T12:00:00.000Z");
    const base = resolveSubscriptionExtensionBaseStart({
      now,
      subscriptionEndsAt,
      subscriptionStatus: "ACTIVE",
      trialEndsAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    expect(base.getTime()).toBe(subscriptionEndsAt.getTime());
  });

  it("resolveSubscriptionExtensionBaseStart uses now when trial expired", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const base = resolveSubscriptionExtensionBaseStart({
      now,
      subscriptionEndsAt: null,
      subscriptionStatus: "EXPIRED",
      trialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    expect(base.getTime()).toBe(now.getTime());
  });

  it("trial payment extends from trialEndsAt (FIRST_MONTH example)", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const trialEndsAt = new Date("2026-06-11T12:00:00.000Z");
    const base = resolveSubscriptionExtensionBaseStart({
      now,
      subscriptionEndsAt: null,
      subscriptionStatus: "TRIALING",
      trialEndsAt,
    });
    const end = subscriptionEndAfterPlan(base, "FIRST_MONTH");
    const expected = addCalendarMonths(trialEndsAt, 1);
    expect(end.getTime()).toBe(expected.getTime());
  });
});
