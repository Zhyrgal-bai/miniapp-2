import { beforeEach, describe, expect, it } from "vitest";
import {
  readCheckoutAutofillHints,
  rememberCheckoutAutofill,
  rememberVerticalPreset,
  resolveCheckoutAutofill,
  resolveVerticalPresetBySchema,
} from "../../frontend/src/storefront/customerAutofillStorage";

function createLocalStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("customerAutofillStorage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
  });

  it("resolves checkout autofill by precedence", () => {
    const resolved = resolveCheckoutAutofill({
      explicit: { name: "", phone: "  ", address: "" },
      saved: { name: "Saved Name", phone: "Saved Phone", address: "Saved Address" },
      recentOrder: { name: "Recent Name", phone: "Recent Phone", address: "Recent Address" },
      telegram: { name: "Telegram Name", phone: "Telegram Phone", address: "Telegram Address" },
    });
    expect(resolved).toEqual({
      name: "Saved Name",
      phone: "Saved Phone",
      address: "Saved Address",
    });
  });

  it("stores profile, addresses and recipients", () => {
    rememberCheckoutAutofill(12, {
      name: "Aibek",
      phone: "+996555000111",
      address: "Bishkek, Chui 12",
      deliveryType: "delivery",
    });
    rememberCheckoutAutofill(12, {
      name: "Aibek",
      phone: "+996555000111",
      address: "Bishkek, Toktogul 5",
      deliveryType: "delivery",
    });
    const hints = readCheckoutAutofillHints(12);
    expect(hints.profile.name).toBe("Aibek");
    expect(hints.addresses.home).toBe("Bishkek, Chui 12");
    expect(hints.addresses.work).toBe("Bishkek, Toktogul 5");
    expect(hints.addresses.last).toBe("Bishkek, Toktogul 5");
    expect(hints.recentAddresses[0]).toBe("Bishkek, Toktogul 5");
    expect(hints.recentRecipients[0]).toEqual({
      name: "Aibek",
      phone: "+996555000111",
    });
  });

  it("restores vertical presets filtered by schema", () => {
    rememberVerticalPreset(88, "coffee", {
      milk: "soy",
      sugar: "50",
      syrups: ["vanilla", "hazelnut"],
      unknown: "skip",
    });
    const restored = resolveVerticalPresetBySchema(
      88,
      "coffee",
      {
        milk: { type: "select" },
        sugar: { type: "select" },
        syrups: { type: "multiselect" },
      },
    );
    expect(restored).toEqual({
      milk: "soy",
      sugar: "50",
      syrups: ["vanilla", "hazelnut"],
    });
  });
});
