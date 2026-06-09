import { describe, expect, it } from "vitest";
import {
  computeLoyaltyAccrual,
  computeRedeemableValueSom,
  normalizeLoyaltyRules,
  resolveLoyaltyTier,
  validateLoyaltyRules,
  type LoyaltyProgramRules,
} from "../../src/shared/loyaltyModel.js";

const rules: LoyaltyProgramRules = {
  enabled: true,
  pointsPerOrder: 10,
  pointsPerSomSpent: 100,
  redeemThreshold: 100,
  redeemValueSom: 100,
};

describe("loyaltyModel", () => {
  it("accrues per order plus per spend", () => {
    expect(computeLoyaltyAccrual(rules, { totalSom: 500 })).toBe(15); // 10 + floor(500/100)
  });

  it("accrues nothing when disabled", () => {
    expect(computeLoyaltyAccrual({ ...rules, enabled: false }, { totalSom: 500 })).toBe(0);
  });

  it("resolves tiers by points", () => {
    expect(resolveLoyaltyTier(0)).toBe("bronze");
    expect(resolveLoyaltyTier(200)).toBe("silver");
    expect(resolveLoyaltyTier(500)).toBe("gold");
    expect(resolveLoyaltyTier(1000)).toBe("platinum");
  });

  it("computes redeemable value", () => {
    expect(computeRedeemableValueSom(rules, 250)).toBe(200); // floor(250/100)*100
    expect(computeRedeemableValueSom({ ...rules, enabled: false }, 250)).toBe(0);
  });

  it("validates and normalizes rules", () => {
    expect(validateLoyaltyRules({ pointsPerOrder: -1 }).ok).toBe(false);
    expect(validateLoyaltyRules({ pointsPerOrder: 5 }).ok).toBe(true);
    const norm = normalizeLoyaltyRules({ enabled: true, pointsPerOrder: 7.6 });
    expect(norm.pointsPerOrder).toBe(8);
    expect(norm.enabled).toBe(true);
  });
});
