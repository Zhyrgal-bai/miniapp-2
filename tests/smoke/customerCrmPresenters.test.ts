import { describe, expect, it } from "vitest";
import {
  customerInitials,
  formatCustomerLastOrder,
  formatLifetimeValue,
  resolveCustomerBadges,
  sortCustomers,
} from "../../frontend/src/utils/customerCrm";
import type { MerchantCustomerRow } from "../../frontend/src/services/admin.service";

function row(partial: Partial<MerchantCustomerRow>): MerchantCustomerRow {
  return {
    customerKey: partial.customerKey ?? "user:1",
    buyerUserId: partial.buyerUserId ?? 1,
    telegramId: null,
    username: null,
    name: partial.name ?? "Гость",
    phone: partial.phone ?? null,
    phoneNormalized: null,
    address: null,
    ordersCount: partial.ordersCount ?? 0,
    totalOrders: partial.totalOrders ?? 0,
    cancelledOrders: 0,
    lifetimeValue: partial.lifetimeValue ?? 0,
    averageOrderValue: 0,
    firstOrderAt: null,
    lastOrderAt: partial.lastOrderAt ?? null,
    daysSinceLastOrder: partial.daysSinceLastOrder ?? null,
    segments: partial.segments ?? [],
  };
}

describe("customerCrm presenters", () => {
  it("resolves badge tones for known segments", () => {
    const badges = resolveCustomerBadges(["best", "inactive"]);
    expect(badges.map((b) => b.tone)).toEqual(["gold", "red"]);
    expect(resolveCustomerBadges(undefined)).toEqual([]);
  });

  it("formats lifetime value with separators", () => {
    expect(formatLifetimeValue(1234567)).toBe("1 234 567 сом");
    expect(formatLifetimeValue(0)).toBe("0 сом");
    expect(formatLifetimeValue(null)).toBe("0 сом");
  });

  it("formats last order recency", () => {
    expect(formatCustomerLastOrder(null)).toBe("Нет заказов");
    expect(formatCustomerLastOrder(0)).toBe("Сегодня");
    expect(formatCustomerLastOrder(1)).toBe("Вчера");
    expect(formatCustomerLastOrder(3)).toBe("3 дн. назад");
    expect(formatCustomerLastOrder(40)).toBe("1 мес. назад");
  });

  it("computes initials", () => {
    expect(customerInitials("Aibek Test")).toBe("AT");
    expect(customerInitials("Aibek")).toBe("A");
    expect(customerInitials("")).toBe("?");
  });

  it("sorts customers by chosen key", () => {
    const rows = [
      row({ customerKey: "user:1", lifetimeValue: 100, ordersCount: 5, lastOrderAt: "2026-06-01" }),
      row({ customerKey: "user:2", lifetimeValue: 500, ordersCount: 1, lastOrderAt: "2026-06-09" }),
    ];
    expect(sortCustomers(rows, "value")[0]!.customerKey).toBe("user:2");
    expect(sortCustomers(rows, "orders")[0]!.customerKey).toBe("user:1");
    expect(sortCustomers(rows, "recent")[0]!.customerKey).toBe("user:2");
  });
});
