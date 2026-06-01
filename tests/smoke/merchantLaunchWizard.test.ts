import { describe, expect, it } from "vitest";
import { buildLaunchWizardPayload } from "../../src/server/merchantGrowthService.js";

describe("buildLaunchWizardPayload", () => {
  it("marks all steps done when store is launch-ready", () => {
    const w = buildLaunchWizardPayload({
      subscriptionActive: true,
      botConnected: true,
      finikReady: true,
      hasProduct: true,
      storefrontPublished: true,
      hasTestOrder: true,
    });
    expect(w.complete).toBe(true);
    expect(w.completedCount).toBe(6);
    expect(w.currentStepIndex).toBe(-1);
  });

  it("highlights first incomplete step after approve", () => {
    const w = buildLaunchWizardPayload({
      subscriptionActive: true,
      botConnected: false,
      finikReady: false,
      hasProduct: false,
      storefrontPublished: false,
      hasTestOrder: false,
    });
    expect(w.complete).toBe(false);
    expect(w.currentStepIndex).toBe(1);
    expect(w.steps[1]?.id).toBe("telegram_bot");
    expect(w.steps[1]?.done).toBe(false);
  });

  it("requires at least one product, not five", () => {
    const w = buildLaunchWizardPayload({
      subscriptionActive: true,
      botConnected: true,
      finikReady: true,
      hasProduct: true,
      storefrontPublished: false,
      hasTestOrder: false,
    });
    const product = w.steps.find((s) => s.id === "product");
    expect(product?.done).toBe(true);
  });
});
