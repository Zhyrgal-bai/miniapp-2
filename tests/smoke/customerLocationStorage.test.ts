import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage);
  vi.stubGlobal("window", {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("customerLocationStorage", () => {
  beforeEach(async () => {
    installLocalStorageMock();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unknown for new tenant", async () => {
    const mod = await import("../../frontend/src/storefront/customerLocationStorage.js");
    const r = mod.loadCustomerLocation(42);
    expect(r.consent).toBe("unknown");
    expect(mod.hasCustomerLocationConsentDecision(42)).toBe(false);
  });

  it("persists denied consent", async () => {
    const mod = await import("../../frontend/src/storefront/customerLocationStorage.js");
    mod.markCustomerLocationDenied(7);
    expect(mod.hasCustomerLocationConsentDecision(7)).toBe(true);
    expect(mod.loadCustomerLocation(7).consent).toBe("denied");
    expect(mod.readCustomerLocationCoords(7)).toBeNull();
  });

  it("persists granted coords", async () => {
    const mod = await import("../../frontend/src/storefront/customerLocationStorage.js");
    mod.markCustomerLocationGranted(9, { latitude: 42.87, longitude: 74.61 });
    const r = mod.loadCustomerLocation(9);
    expect(r.consent).toBe("granted");
    expect(mod.readCustomerLocationCoords(9)).toEqual({
      latitude: 42.87,
      longitude: 74.61,
    });
  });
});
