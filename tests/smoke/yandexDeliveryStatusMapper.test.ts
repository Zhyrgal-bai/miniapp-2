import { describe, expect, it } from "vitest";
import {
  mapInternalStatusToDeliveryStage,
  mapYandexStatusToInternal,
  shouldAdvanceStatus,
  statusRank,
} from "../../src/server/delivery/providers/yandex/services/YandexDeliveryStatusMapper.js";

describe("YandexDeliveryStatusMapper", () => {
  it("maps Yandex statuses to internal ARCHA statuses", () => {
    expect(mapYandexStatusToInternal("new")).toBe("CREATED");
    expect(mapYandexStatusToInternal("accepted")).toBe("SEARCHING_COURIER");
    expect(mapYandexStatusToInternal("performer_lookup")).toBe("SEARCHING_COURIER");
    expect(mapYandexStatusToInternal("performer_found")).toBe("COURIER_ASSIGNED");
    expect(mapYandexStatusToInternal("pickup_arrived")).toBe("COURIER_AT_PICKUP");
    expect(mapYandexStatusToInternal("pickuped")).toBe("PICKED_UP");
    expect(mapYandexStatusToInternal("delivery_arrived")).toBe("DELIVERING");
    expect(mapYandexStatusToInternal("delivered")).toBe("DELIVERED");
    expect(mapYandexStatusToInternal("delivered_finish")).toBe("DELIVERED");
    expect(mapYandexStatusToInternal("cancelled")).toBe("CANCELLED");
    expect(mapYandexStatusToInternal("cancelled_by_taxi")).toBe("CANCELLED");
    expect(mapYandexStatusToInternal("failed")).toBe("FAILED");
    expect(mapYandexStatusToInternal("estimating_failed")).toBe("FAILED");
  });

  it("returns null for unknown status", () => {
    expect(mapYandexStatusToInternal("totally_unknown")).toBeNull();
  });

  it("maps internal status to delivery stage", () => {
    expect(mapInternalStatusToDeliveryStage("SEARCHING_COURIER")).toBe("PREPARING");
    expect(mapInternalStatusToDeliveryStage("COURIER_ASSIGNED")).toBe("COURIER_DISPATCHED");
    expect(mapInternalStatusToDeliveryStage("PICKED_UP")).toBe("OUT_FOR_DELIVERY");
    expect(mapInternalStatusToDeliveryStage("DELIVERED")).toBe("DELIVERED");
    expect(mapInternalStatusToDeliveryStage("CANCELLED")).toBeNull();
  });

  it("status rank is monotonic", () => {
    expect(statusRank("CREATED")).toBeLessThan(statusRank("SEARCHING_COURIER"));
    expect(statusRank("SEARCHING_COURIER")).toBeLessThan(statusRank("COURIER_ASSIGNED"));
    expect(statusRank("DELIVERING")).toBeLessThan(statusRank("DELIVERED"));
    expect(shouldAdvanceStatus("SEARCHING_COURIER", "COURIER_ASSIGNED")).toBe(true);
    expect(shouldAdvanceStatus("DELIVERED", "DELIVERING")).toBe(false);
  });
});
