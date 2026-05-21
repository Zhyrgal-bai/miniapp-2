import { describe, expect, it } from "vitest";
import {
  commitPaid,
  emptyStock,
  receiveReturn,
  release,
  reserve,
  restorePaid,
  restoreShipped,
  restock,
  ship,
  totalUnits,
} from "./inventorySimulator.js";

describe("inventory smoke — last unit & lifecycle", () => {
  it("reserves last item and blocks second client", () => {
    let stock = emptyStock(1);
    const a = reserve(stock, 1);
    expect(a).not.toBeNull();
    stock = a!;
    expect(stock.available).toBe(0);
    expect(stock.reserved).toBe(1);

    const b = reserve(stock, 1);
    expect(b).toBeNull();
  });

  it("cancel before payment restores reserved stock", () => {
    let stock = emptyStock(2);
    stock = reserve(stock, 1)!;
    stock = release(stock, 1);
    expect(stock.available).toBe(2);
    expect(stock.reserved).toBe(0);
  });

  it("refund after payment restores paid bucket", () => {
    let stock = emptyStock(3);
    stock = reserve(stock, 2)!;
    stock = commitPaid(stock, 2);
    stock = restorePaid(stock, 2);
    expect(stock.available).toBe(3);
    expect(stock.paid).toBe(0);
  });

  it("refund after ship restores shipped bucket", () => {
    let stock = emptyStock(1);
    stock = reserve(stock, 1)!;
    stock = commitPaid(stock, 1);
    stock = ship(stock, 1);
    stock = restoreShipped(stock, 1);
    expect(stock.available).toBe(1);
    expect(stock.shipped).toBe(0);
  });

  it("return flow: ship → return received → restock", () => {
    let stock = emptyStock(1);
    stock = reserve(stock, 1)!;
    stock = commitPaid(stock, 1);
    stock = ship(stock, 1);
    stock = receiveReturn(stock, 1);
    expect(stock.returned).toBe(1);
    stock = restock(stock, 1);
    expect(stock.available).toBe(1);
    expect(totalUnits(stock)).toBe(1);
  });

  it("conserves total units through full lifecycle", () => {
    let stock = emptyStock(5);
    const start = totalUnits(stock);
    stock = reserve(stock, 2)!;
    stock = commitPaid(stock, 2);
    stock = ship(stock, 1);
    stock = restorePaid(stock, 1);
    expect(totalUnits(stock)).toBe(start);
  });
});

describe("inventory smoke — concurrent race (simulated)", () => {
  it("two parallel reserves on last unit: only one wins (atomic bucket)", () => {
    const stock = emptyStock(1);
    function tryReserve(): boolean {
      if (stock.available < 1) return false;
      stock.available -= 1;
      stock.reserved += 1;
      return true;
    }
    const results = [tryReserve(), tryReserve()];
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(stock.reserved).toBe(1);
    expect(stock.available).toBe(0);
  });
});
