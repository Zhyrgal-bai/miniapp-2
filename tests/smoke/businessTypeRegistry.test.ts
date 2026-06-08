import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPE_IDS,
  BUSINESS_TYPE_REGISTRATION_CARDS,
  isBusinessTypeId,
  isTargetBusinessTypeId,
  normalizeProvisionBusinessType,
  normalizeRegistrationBusinessType,
} from "../../src/shared/businessTypes.js";

describe("business type registry", () => {
  it("contains legacy + target ids", () => {
    expect(BUSINESS_TYPE_IDS).toContain("universal");
    expect(BUSINESS_TYPE_IDS).toContain("electronics");
    expect(BUSINESS_TYPE_IDS).toContain("autoparts");
    expect(BUSINESS_TYPE_IDS).toContain("cosmetics");
    expect(BUSINESS_TYPE_IDS).toContain("furniture");
  });

  it("restricts registration cards to target set", () => {
    const ids = BUSINESS_TYPE_REGISTRATION_CARDS.map((x) => x.id);
    expect(ids).not.toContain("universal");
    expect(ids).toContain("clothing");
    expect(ids).toContain("flowers");
    expect(ids).toContain("electronics");
    expect(ids).toContain("autoparts");
    expect(ids).toContain("cosmetics");
    expect(ids).toContain("furniture");
  });

  it("normalizes registration and provision business types", () => {
    expect(normalizeRegistrationBusinessType("electronics")).toBe("electronics");
    expect(normalizeRegistrationBusinessType("universal")).toBe("clothing");
    expect(normalizeProvisionBusinessType("universal")).toBe("universal");
    expect(normalizeProvisionBusinessType("unknown")).toBe("clothing");
  });

  it("guards ids with predicates", () => {
    expect(isBusinessTypeId("universal")).toBe(true);
    expect(isBusinessTypeId("furniture")).toBe(true);
    expect(isBusinessTypeId("invalid")).toBe(false);
    expect(isTargetBusinessTypeId("furniture")).toBe(true);
    expect(isTargetBusinessTypeId("universal")).toBe(false);
  });
});

