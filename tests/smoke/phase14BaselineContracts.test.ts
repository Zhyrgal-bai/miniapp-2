import { describe, expect, it } from "vitest";
import {
  ORDER_ANALYTICS_SUCCESS_STATUSES_DB,
  isOrderAnalyticsSuccessStatus,
} from "../../src/shared/orderAnalytics.js";
import { resolveFeatureFlags } from "../../src/storefront/featureFlags.js";

describe("phase14 baseline contracts", () => {
  it("keeps analytics success statuses centralized and strict", () => {
    expect([...ORDER_ANALYTICS_SUCCESS_STATUSES_DB]).toEqual([
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ]);
    expect(isOrderAnalyticsSuccessStatus("confirmed")).toBe(true);
    expect(isOrderAnalyticsSuccessStatus("PAID")).toBe(true);
    expect(isOrderAnalyticsSuccessStatus("COMPLETED")).toBe(true);
    expect(isOrderAnalyticsSuccessStatus("NEW")).toBe(false);
    expect(isOrderAnalyticsSuccessStatus("CANCELLED")).toBe(false);
  });

  it("resolves rollout flags with safe defaults", () => {
    const defaults = resolveFeatureFlags({});
    expect(defaults.enableProductModalV3).toBe(true);
    expect(defaults.enableLifetimeAnalyticsV2).toBe(true);

    const disabled = resolveFeatureFlags({
      enableProductModalV3: false,
      enableLifetimeAnalyticsV2: false,
    });
    expect(disabled.enableProductModalV3).toBe(false);
    expect(disabled.enableLifetimeAnalyticsV2).toBe(false);
  });
});
