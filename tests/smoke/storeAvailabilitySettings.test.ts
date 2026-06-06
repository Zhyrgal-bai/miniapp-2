import { describe, expect, it } from "vitest";
import {
  defaultStoreAvailabilitySettings,
  formatEtaRange,
  parseStoreAvailabilitySettings,
  resolveDeliveryEtaForKm,
  resolveStoreAvailabilityStatus,
  storeAvailabilityPreset,
  storeAvailabilityToPublic,
  buildClosedCheckoutNotice,
} from "../../src/shared/storeAvailabilitySettings.js";

describe("storeAvailabilitySettings", () => {
  it("parses empty as defaults", () => {
    const p = parseStoreAvailabilitySettings({});
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.timezone).toBe("Asia/Bishkek");
    expect(p.value.deliveryEta.minMinutes).toBe(25);
  });

  it("coffee preset uses 08:00–22:00", () => {
    const s = storeAvailabilityPreset("coffee");
    expect(s.schedule.mon.open).toBe("08:00");
    expect(s.schedule.mon.close).toBe("22:00");
  });

  it("detects OPEN during business hours in Bishkek TZ", () => {
    const s = defaultStoreAvailabilitySettings();
    s.schedule.mon = { closed: false, open: "09:00", close: "22:00" };
    const now = new Date("2026-06-08T08:00:00.000Z"); // Mon 14:00 Bishkek
    const st = resolveStoreAvailabilityStatus(s, now);
    expect(st.status).toBe("OPEN");
    expect(st.isOpen).toBe(true);
    expect(st.label).toContain("открыто");
  });

  it("detects CLOSED on Sunday when day is closed", () => {
    const s = defaultStoreAvailabilitySettings();
    s.schedule.sun = { closed: true, open: "09:00", close: "22:00" };
    const now = new Date("2026-06-07T08:00:00.000Z"); // Sun 14:00 Bishkek
    const st = resolveStoreAvailabilityStatus(s, now);
    expect(st.status).toBe("CLOSED");
    expect(st.isOpen).toBe(false);
  });

  it("detects CLOSING_SOON within threshold", () => {
    const s = defaultStoreAvailabilitySettings();
    s.soonThresholdMinutes = 120;
    s.schedule.mon = { closed: false, open: "09:00", close: "22:00" };
    const now = new Date("2026-06-08T15:30:00.000Z"); // Mon 21:30 Bishkek
    const st = resolveStoreAvailabilityStatus(s, now);
    expect(st.status).toBe("CLOSING_SOON");
  });

  it("resolves delivery zone ETA by distance", () => {
    const s = defaultStoreAvailabilitySettings();
    const eta = resolveDeliveryEtaForKm(s, 2);
    expect(eta.minMinutes).toBe(25);
    expect(eta.maxMinutes).toBe(35);
    const etaFar = resolveDeliveryEtaForKm(s, 10);
    expect(etaFar.minMinutes).toBe(50);
  });

  it("builds closed checkout notice", () => {
    const s = defaultStoreAvailabilitySettings();
    s.schedule.mon = { closed: false, open: "09:00", close: "22:00" };
    const now = new Date("2026-06-08T16:30:00.000Z"); // Mon 22:30 Bishkek — closed
    const notice = buildClosedCheckoutNotice(s, now);
    expect(notice).toMatch(/Магазин сейчас закрыт/);
  });

  it("public payload includes ETA labels", () => {
    const pub = storeAvailabilityToPublic(defaultStoreAvailabilitySettings());
    expect(formatEtaRange(pub.deliveryEta)).toMatch(/25–40/);
    expect(pub.deliveryZones.length).toBeGreaterThan(0);
  });

  it("public payload includes weekly schedule", () => {
    const pub = storeAvailabilityToPublic(defaultStoreAvailabilitySettings());
    expect(pub.weeklySchedule).toHaveLength(7);
    expect(pub.weeklySchedule[0]?.dayLabel).toBe("Пн");
  });
});
