import { describe, expect, it } from "vitest";
import {
  businessAddressRowToPublic,
  parseBusinessAddressInput,
} from "../../src/shared/businessAddress.js";

describe("businessAddress", () => {
  it("parses valid Bishkek address", () => {
    const out = parseBusinessAddressInput({
      addressLine: "ул. Чуй 123",
      city: "Бишкек",
      latitude: 42.8746,
      longitude: 74.5698,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.city).toBe("Бишкек");
      expect(out.value.latitude).toBeCloseTo(42.8746, 4);
    }
  });

  it("rejects missing coordinates", () => {
    const out = parseBusinessAddressInput({
      addressLine: "ул. Тест 1",
      city: "Ош",
    });
    expect(out.ok).toBe(false);
  });

  it("public DTO null when empty", () => {
    expect(
      businessAddressRowToPublic({
        addressLine: null,
        city: null,
        latitude: null,
        longitude: null,
      }),
    ).toBeNull();
  });
});
