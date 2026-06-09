import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SEGMENT_THRESHOLDS,
  aggregateMerchantCustomers,
  classifyCustomerSegments,
  isReturningCustomer,
  normalizePhone,
  resolveCustomerKey,
  type CustomerOrderInput,
} from "../../src/shared/customerProfile.js";
import { extractVerticalPreferences } from "../../src/shared/customerVerticalPrefs.js";

function order(partial: Partial<CustomerOrderInput>): CustomerOrderInput {
  return {
    id: partial.id ?? 1,
    status: partial.status ?? "CONFIRMED",
    total: partial.total ?? 1000,
    buyerUserId: partial.buyerUserId ?? null,
    name: partial.name ?? null,
    phone: partial.phone ?? null,
    address: partial.address ?? null,
    createdAt: partial.createdAt ?? new Date(),
    buyerName: partial.buyerName ?? null,
    buyerTelegramId: partial.buyerTelegramId ?? null,
    buyerUsername: partial.buyerUsername ?? null,
  };
}

describe("normalizePhone", () => {
  it("maps KG formats to canonical 996XXXXXXXXX", () => {
    expect(normalizePhone("+996700123456")).toBe("996700123456");
    expect(normalizePhone("0700123456")).toBe("996700123456");
    expect(normalizePhone("700123456")).toBe("996700123456");
    expect(normalizePhone("+996 700 123 456")).toBe("996700123456");
  });

  it("returns null for empty input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("resolveCustomerKey", () => {
  it("prefers buyerUserId", () => {
    expect(resolveCustomerKey({ buyerUserId: 42, phone: "0700123456" })).toBe("user:42");
  });
  it("falls back to normalized phone", () => {
    expect(resolveCustomerKey({ buyerUserId: null, phone: "0700123456" })).toBe(
      "phone:996700123456",
    );
  });
  it("returns anon when nothing identifies the buyer", () => {
    expect(resolveCustomerKey({ buyerUserId: null, phone: null })).toBe("anon");
  });
});

describe("aggregateMerchantCustomers", () => {
  it("groups orders by buyer and computes paid stats", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const rows = aggregateMerchantCustomers(
      [
        order({ id: 1, buyerUserId: 7, total: 1000, status: "DELIVERED", createdAt: new Date("2026-06-01T00:00:00Z"), name: "Aibek", phone: "0700111222" }),
        order({ id: 2, buyerUserId: 7, total: 2000, status: "CONFIRMED", createdAt: new Date("2026-06-05T00:00:00Z") }),
        order({ id: 3, buyerUserId: 7, total: 500, status: "CANCELLED", createdAt: new Date("2026-06-06T00:00:00Z") }),
        order({ id: 4, buyerUserId: 9, total: 3000, status: "NEW", createdAt: new Date("2026-06-07T00:00:00Z") }),
      ],
      now,
    );
    const aibek = rows.find((r) => r.customerKey === "user:7");
    expect(aibek).toBeTruthy();
    expect(aibek!.ordersCount).toBe(2);
    expect(aibek!.totalOrders).toBe(3);
    expect(aibek!.cancelledOrders).toBe(1);
    expect(aibek!.lifetimeValue).toBe(3000);
    expect(aibek!.name).toBe("Aibek");

    const guest = rows.find((r) => r.customerKey === "user:9");
    expect(guest!.ordersCount).toBe(0);
    expect(guest!.lifetimeValue).toBe(0);
  });

  it("skips anonymous orders without identity", () => {
    const rows = aggregateMerchantCustomers([
      order({ id: 1, buyerUserId: null, phone: null }),
    ]);
    expect(rows.length).toBe(0);
  });
});

describe("classifyCustomerSegments", () => {
  it("classifies deterministic segments", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const rows = aggregateMerchantCustomers(
      [
        order({ id: 1, buyerUserId: 1, total: 25000, status: "DELIVERED", createdAt: new Date("2026-06-01T00:00:00Z") }),
        order({ id: 2, buyerUserId: 1, total: 25000, status: "DELIVERED", createdAt: new Date("2026-06-02T00:00:00Z") }),
        order({ id: 3, buyerUserId: 1, total: 25000, status: "DELIVERED", createdAt: new Date("2026-06-03T00:00:00Z") }),
        order({ id: 4, buyerUserId: 1, total: 25000, status: "DELIVERED", createdAt: new Date("2026-06-04T00:00:00Z") }),
      ],
      now,
    );
    const segments = classifyCustomerSegments(rows[0]!, {
      bestKeys: new Set(["user:1"]),
    });
    expect(segments).toContain("best");
    expect(segments).toContain("high_value");
    expect(segments).toContain("frequent");
    expect(segments).toContain("returning");
  });

  it("flags inactive customers past the window", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const stale = new Date(now.getTime() - (CUSTOMER_SEGMENT_THRESHOLDS.inactiveAfterDays + 5) * 86400000);
    const rows = aggregateMerchantCustomers(
      [order({ id: 1, buyerUserId: 2, status: "DELIVERED", createdAt: stale })],
      now,
    );
    expect(classifyCustomerSegments(rows[0]!)).toContain("inactive");
    expect(isReturningCustomer(rows[0]!)).toBe(false);
  });
});

describe("extractVerticalPreferences", () => {
  it("extracts coffee favorites from order options", () => {
    const prefs = extractVerticalPreferences("coffee", [
      { size: "350ml", options: { milk: "soy", sugar: "50", hotOrCold: "hot" } },
      { size: "350ml", options: { milk: "soy", sugar: "50", hotOrCold: "ice" } },
    ]);
    const milk = prefs.find((p) => p.key === "milk");
    expect(milk?.valueLabel).toBe("Соевое");
    const sugar = prefs.find((p) => p.key === "sugar");
    expect(sugar?.valueLabel).toBe("50%");
  });

  it("extracts autoparts VIN preference", () => {
    const prefs = extractVerticalPreferences("autoparts", [
      { options: { vin: "WVWZZZ1JZXW000001" } },
    ]);
    expect(prefs.find((p) => p.key === "vin")?.value).toBe("WVWZZZ1JZXW000001");
  });
});
