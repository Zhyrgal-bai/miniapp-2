import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as structuredLog from "../../src/server/structuredLog.js";
import { YandexWebhookService } from "../../src/server/delivery/providers/yandex/services/YandexWebhookService.js";
import type { DeliveryRefreshService } from "../../src/server/delivery/services/DeliveryRefreshService.js";

describe("YandexWebhookService", () => {
  beforeEach(() => {
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing claim id", async () => {
    const service = new YandexWebhookService();
    const result = await service.processWebhook({ claimId: "", updatedTs: "1" });
    expect(result).toEqual({ ok: false, code: "missing_claim_id", httpStatus: 400 });
  });

  it("is idempotent on duplicate webhook", async () => {
    const refreshService: DeliveryRefreshService = {
      refreshClaim: vi.fn().mockResolvedValue({
        ok: true,
        applied: false,
        duplicate: true,
        orderId: 100,
        internalStatus: "COURIER_ASSIGNED",
      }),
    };
    const service = new YandexWebhookService({ refreshService });

    const result = await service.processWebhook({
      claimId: "claim-abc",
      updatedTs: "2026-06-10T11:00:00Z",
    });

    expect(result).toEqual({ ok: true, duplicate: true, orderId: 100 });
    expect(refreshService.refreshClaim).toHaveBeenCalledWith(
      "claim-abc",
      expect.objectContaining({
        idempotencyKey: "claim-abc:2026-06-10T11:00:00Z",
        source: "webhook",
      }),
    );
  });

  it("processes delivered status", async () => {
    const refreshService: DeliveryRefreshService = {
      refreshClaim: vi.fn().mockResolvedValue({
        ok: true,
        applied: true,
        duplicate: false,
        orderId: 100,
        internalStatus: "DELIVERED",
      }),
    };
    const service = new YandexWebhookService({ refreshService });

    const result = await service.processWebhook({
      claimId: "claim-abc",
      updatedTs: "2026-06-10T12:00:00Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.duplicate).toBe(false);
      expect(result.orderId).toBe(100);
    }
  });

  it("handles cancelled delivery as ok", async () => {
    const refreshService: DeliveryRefreshService = {
      refreshClaim: vi.fn().mockResolvedValue({
        ok: true,
        applied: true,
        duplicate: false,
        orderId: 100,
        internalStatus: "CANCELLED",
      }),
    };
    const service = new YandexWebhookService({ refreshService });

    const result = await service.processWebhook({
      claimId: "claim-abc",
      updatedTs: "2026-06-10T12:00:00Z",
    });

    expect(result.ok).toBe(true);
  });

  it("ignores unknown status without error", async () => {
    const refreshService: DeliveryRefreshService = {
      refreshClaim: vi.fn().mockResolvedValue({
        ok: false,
        code: "unknown_status",
        error: "unknown",
        retryable: false,
        orderId: 100,
      }),
    };
    const service = new YandexWebhookService({ refreshService });

    const result = await service.processWebhook({
      claimId: "claim-abc",
      updatedTs: "1",
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ orderId: 100 });
  });
});
