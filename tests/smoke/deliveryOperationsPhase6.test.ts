import { describe, expect, it, vi } from "vitest";
import { maskPhone, sanitizeExportRow } from "../../src/server/delivery/operations/dto/deliveryOperationsDto.js";
import {
  createDeliveryTimelineRecorder,
} from "../../src/server/delivery/operations/services/deliveryTimelineRecorder.js";
import {
  createDeliveryExportService,
  parseExportFormat,
} from "../../src/server/delivery/operations/services/deliveryExportService.js";
import {
  parseDeliverySearchQuery,
} from "../../src/server/delivery/operations/services/deliverySearchService.js";
import {
  createDeliveryEventsUiService,
} from "../../src/server/delivery/operations/services/deliveryEventsUiService.js";
import {
  createDeliveryManualOperationsService,
} from "../../src/server/delivery/operations/services/deliveryManualOperationsService.js";
import {
  createDeliveryOperationsDetailService,
} from "../../src/server/delivery/operations/services/deliveryOperationsDetailService.js";
import { resetDeliveryMetricsForTests } from "../../src/server/delivery/utils/deliveryMetrics.js";
import type { ProviderDeliveryRecord } from "../../src/server/delivery/types/providerDeliveryTypes.js";

const delivery: ProviderDeliveryRecord = {
  id: 10,
  orderId: 100,
  businessId: 5,
  buyerUserId: 7,
  provider: "yandex",
  providerClaimId: "claim-1",
  providerOfferId: "express:fast",
  price: 200,
  currency: "KGS",
  status: "DELIVERING",
  providerStatus: "delivery_arrived",
  providerUpdatedAt: new Date("2026-06-10T12:00:00Z"),
  courierName: "Ivan",
  courierPhone: "+996700000000",
  vehicleNumber: "B1234",
  etaMinutes: 8,
  trackingUrl: "https://track.example",
  courierLat: null,
  courierLng: null,
  lastWebhookKey: null,
  providerPayload: { secret: "x" },
  lastErrorCode: null,
  lastErrorMessage: null,
  recoveryRetryCount: 0,
  recoveryNextRetryAt: null,
  recoveryLastError: null,
  createdAt: new Date("2026-06-10T10:00:00Z"),
  updatedAt: new Date("2026-06-10T12:00:00Z"),
};

describe("deliveryOperations phase6", () => {
  it("masks phone in DTO", () => {
    expect(maskPhone("+996700123456")).toBe("***3456");
  });

  it("sanitizes export rows", () => {
    const row = sanitizeExportRow({
      phone: "+996700123456",
      providerPayload: { x: 1 },
      courierPhone: "+996700000000",
      status: "DELIVERING",
    });
    expect(row.providerPayload).toBeUndefined();
    expect(row.courierPhone).toBeUndefined();
    expect(row.phone).toBe("***3456");
  });

  it("records append-only timeline", async () => {
    const appended: unknown[] = [];
    const recorder = createDeliveryTimelineRecorder({
      timeline: {
        append: async (input) => {
          appended.push(input);
          return {
            id: 1,
            ...input,
            detail: input.detail ?? null,
            metadata: input.metadata ?? null,
            actor: input.actor ?? "SYSTEM",
            createdAt: new Date(),
          };
        },
        listByDeliveryId: async () => [],
        listByOrderId: async () => [],
      },
      audit: {
        append: async (input) => ({
          id: 1,
          providerDeliveryId: input.providerDeliveryId ?? null,
          orderId: input.orderId ?? null,
          businessId: input.businessId ?? null,
          provider: input.provider ?? null,
          actor: input.actor,
          actorId: input.actorId ?? null,
          action: input.action,
          details: input.details ?? null,
          createdAt: new Date(),
        }),
        listByDeliveryId: async () => [],
        listByBusinessId: async () => [],
        listPlatform: async () => [],
      },
    });

    await recorder.recordTimeline({
      providerDeliveryId: 10,
      orderId: 100,
      businessId: 5,
      provider: "yandex",
      kind: "MANUAL_REFRESH",
      title: "Manual refresh",
      actor: "PLATFORM_OPERATOR",
    });

    expect(appended).toHaveLength(1);
  });

  it("parses search query with pagination", () => {
    const { filters, page, pageSize } = parseDeliverySearchQuery({
      claimId: "abc",
      page: "2",
      pageSize: "50",
      recoveryStatus: "recovering",
    });
    expect(page).toBe(2);
    expect(pageSize).toBe(50);
    expect(filters.claimId).toBe("abc");
    expect(filters.recoveryStatus).toBe("recovering");
  });

  it("exports csv and json", () => {
    resetDeliveryMetricsForTests();
    const exporter = createDeliveryExportService();
    const csv = exporter.exportRows("dashboard", "csv", [{ a: 1 }], "PLATFORM_OPERATOR");
    expect(csv.contentType).toContain("csv");
    expect(csv.body).toContain("a");

    const json = exporter.exportRows("timeline", parseExportFormat("json"), [{ b: 2 }], "MERCHANT");
    expect(JSON.parse(json.body).rows).toHaveLength(1);
  });

  it("maps UI events without secrets", async () => {
    const eventsUi = createDeliveryEventsUiService({
      timelineRepo: {
        listByOrderId: async () => [
          {
            id: 1,
            providerDeliveryId: 10,
            orderId: 100,
            businessId: 5,
            provider: "yandex",
            kind: "DELIVERED",
            title: "Delivered",
            detail: null,
            metadata: { internalStatus: "DELIVERED" },
            actor: "WEBHOOK",
            createdAt: new Date("2026-06-10T13:00:00Z"),
          },
        ],
        listByDeliveryId: async () => [],
        append: async () => ({} as never),
      },
    });

    const events = await eventsUi.getEventsForOrder(100, "CUSTOMER");
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("DELIVERED");
    expect(events[0]?.id).toBe("tl-1");
  });

  it("scopes merchant detail by businessId", async () => {
    const detail = createDeliveryOperationsDetailService({
      operationsRepo: {
        findById: async () => null,
        findByIdForBusiness: async (id, businessId) =>
          id === 10 && businessId === 5
            ? {
                delivery,
                order: {
                  id: 100,
                  orderNumber: "1001",
                  name: "Buyer",
                  phone: "+996700000000",
                  status: "CONFIRMED",
                  total: 1200,
                  deliveryFee: 200,
                  createdAt: new Date(),
                  businessId: 5,
                },
                merchant: { id: 5, name: "Shop", slug: "shop" },
              }
            : null,
        search: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
        countByProvider: async () => ({}),
        listRecoveryQueue: async () => [],
      },
      timelineRepo: {
        listByDeliveryId: async () => [],
        listByOrderId: async () => [],
        append: async () => ({} as never),
      },
      auditRepo: {
        listByDeliveryId: async () => [],
        listByBusinessId: async () => [],
        listPlatform: async () => [],
        append: async () => ({} as never),
      },
    });

    const ok = await detail.getDetails(10, { businessId: 5 });
    const denied = await detail.getDetails(10, { businessId: 99 });

    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.details.customer.phoneMasked).toBe("***0000");
      expect(JSON.stringify(ok.details)).not.toContain("providerPayload");
    }
    expect(denied.ok).toBe(false);
  });

  it("manual refresh delegates to refresh service", async () => {
    const refreshClaim = vi.fn().mockResolvedValue({
      ok: true,
      applied: true,
      duplicate: false,
      orderId: 100,
      internalStatus: "DELIVERING",
    });

    const manual = createDeliveryManualOperationsService({
      refreshService: { refreshClaim },
      recorder: createDeliveryTimelineRecorder({
        timeline: {
          append: async (input) => ({
            id: 1,
            ...input,
            detail: input.detail ?? null,
            metadata: input.metadata ?? null,
            actor: input.actor ?? "SYSTEM",
            createdAt: new Date(),
          }),
          listByDeliveryId: async () => [],
          listByOrderId: async () => [],
        },
        audit: {
          append: async (input) => ({
            id: 1,
            providerDeliveryId: input.providerDeliveryId ?? null,
            orderId: input.orderId ?? null,
            businessId: input.businessId ?? null,
            provider: input.provider ?? null,
            actor: input.actor,
            actorId: input.actorId ?? null,
            action: input.action,
            details: input.details ?? null,
            createdAt: new Date(),
          }),
          listByDeliveryId: async () => [],
          listByBusinessId: async () => [],
          listPlatform: async () => [],
        },
      }),
      operationsRepo: {
        findById: async () => ({
          delivery,
          order: {
            id: 100,
            orderNumber: null,
            name: "Buyer",
            phone: "+996700000000",
            status: "CONFIRMED",
            total: 1200,
            deliveryFee: 200,
            createdAt: new Date(),
            businessId: 5,
          },
          merchant: { id: 5, name: "Shop", slug: "shop" },
        }),
        findByIdForBusiness: async () => null,
        search: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
        countByProvider: async () => ({}),
        listRecoveryQueue: async () => [],
      },
      repository: {
        findByOrderId: async () => delivery,
        findByProviderClaimId: async () => delivery,
        findActiveForRecovery: async () => [],
        findRecoveryRequiredDue: async () => [],
        countByStatus: async () => 0,
        countByBusinessAndStatuses: async () => 0,
        aggregateEtaAndPrice: async () => ({ avgEta: null, avgPrice: null }),
        create: async () => delivery,
        update: async () => delivery,
        updateTrackingSnapshot: async () => delivery,
        updateRecoveryState: async () => delivery,
        clearRecoveryState: async () => delivery,
        appendStatusEvent: async () => ({ ok: true, duplicate: false, event: {} as never }),
      },
    });

    const result = await manual.refreshDelivery(10, { actor: "PLATFORM_OPERATOR" });
    expect(result.ok).toBe(true);
    expect(refreshClaim).toHaveBeenCalledWith(
      "claim-1",
      expect.objectContaining({ source: "manual" }),
    );
  });
});
