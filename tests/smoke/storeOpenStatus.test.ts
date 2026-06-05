import { describe, expect, it } from "vitest";
import { resolveStoreOpenStatus } from "../../frontend/src/utils/storeOpenStatus";

describe("resolveStoreOpenStatus", () => {
  it("defaults to open when no schedule configured", () => {
    const status = resolveStoreOpenStatus({});
    expect(status.isOpen).toBe(true);
    expect(status.label).toContain("Открыт");
  });

  it("respects storeForceClosed", () => {
    const status = resolveStoreOpenStatus({ storeForceClosed: "true" });
    expect(status.isOpen).toBe(false);
    expect(status.label).toContain("Закрыт");
  });

  it("uses custom labels from text config", () => {
    const status = resolveStoreOpenStatus({
      storeStatusOpenLabel: "🟢 Работаем",
      storeStatusClosedLabel: "🔴 Отдыхаем",
      storeForceClosed: "true",
    });
    expect(status.label).toBe("🔴 Отдыхаем");
  });
});
