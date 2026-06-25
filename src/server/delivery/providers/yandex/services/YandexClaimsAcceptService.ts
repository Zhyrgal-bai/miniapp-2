import { createYandexHttpClient, type YandexHttpFetch } from "../client/yandexHttpClient.js";
import type { YandexClaimsAcceptResponseBody } from "../dto/yandexClaimsDto.js";
import {
  mapClaimsAcceptResponse,
  mapClaimsApiError,
  mockClaimsAcceptResponse,
  type YandexClaimsAcceptResult,
} from "../adapters/yandexClaimsAdapter.js";
import {
  isYandexDeliveryConfigured,
  isYandexDeliveryMockEnabled,
  loadYandexDeliveryConfig,
} from "./yandexDeliveryConfig.js";
import { logDeliveryClaimAccept } from "../utils/yandexClaimsLogging.js";

function parseErrorBody(raw: string | undefined): { code?: string; message?: string } {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as { code?: string; message?: string };
  } catch {
    return {};
  }
}

export type YandexClaimsAcceptServiceContext = {
  merchantId: number;
  orderId: number;
  requestId?: string;
  correlationId?: string;
};

export class YandexClaimsAcceptService {
  async accept(
    providerClaimId: string,
    ctx: YandexClaimsAcceptServiceContext,
    options?: { fetchImpl?: YandexHttpFetch },
  ): Promise<YandexClaimsAcceptResult> {
    const started = Date.now();
    const claimId = providerClaimId.trim();
    const logBase = {
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      provider: "yandex" as const,
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
    };

    if (claimId === "") {
      logDeliveryClaimAccept({
        ...logBase,
        durationMs: Date.now() - started,
        ok: false,
        code: "validation_error",
      });
      return {
        ok: false,
        code: "validation_error",
        error: "providerClaimId is required",
      };
    }

    if (!isYandexDeliveryConfigured()) {
      return {
        ok: false,
        code: "not_configured",
        error: "Yandex Delivery is not configured",
      };
    }

    if (isYandexDeliveryMockEnabled()) {
      const mock = mockClaimsAcceptResponse(claimId);
      logDeliveryClaimAccept({
        ...logBase,
        durationMs: Date.now() - started,
        ok: true,
        status: mock.status,
      });
      return mock;
    }

    const config = loadYandexDeliveryConfig();
    const client = createYandexHttpClient(config, {
      ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    const acceptPath = `${config.claimsAcceptPath}?claim_id=${encodeURIComponent(claimId)}`;
    const httpResult = await client.post<YandexClaimsAcceptResponseBody>(
      acceptPath,
      { claim_id: claimId },
      {
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
      },
    );

    if (!httpResult.ok) {
      if (httpResult.kind === "timeout") {
        logDeliveryClaimAccept({
          ...logBase,
          durationMs: httpResult.durationMs,
          ok: false,
          code: "timeout",
        });
        return { ok: false, code: "timeout", error: httpResult.error };
      }
      if (httpResult.kind === "network") {
        logDeliveryClaimAccept({
          ...logBase,
          durationMs: httpResult.durationMs,
          ok: false,
          code: "network_error",
        });
        return { ok: false, code: "network_error", error: httpResult.error };
      }
      if (httpResult.kind === "http" && httpResult.status != null) {
        const failure = mapClaimsApiError(
          httpResult.status,
          parseErrorBody(httpResult.rawBody),
        );
        logDeliveryClaimAccept({
          ...logBase,
          durationMs: httpResult.durationMs,
          ok: false,
          code: failure.code,
          httpStatus: httpResult.status,
        });
        return failure;
      }
      return { ok: false, code: "api_error", error: httpResult.error };
    }

    const mapped = mapClaimsAcceptResponse(httpResult.data);
    if (!mapped) {
      return {
        ok: false,
        code: "api_error",
        error: "Yandex claims/accept returned no claim id",
      };
    }

    logDeliveryClaimAccept({
      ...logBase,
      durationMs: httpResult.durationMs,
      ok: true,
      status: mapped.status,
    });

    return {
      ok: true,
      providerClaimId: mapped.providerClaimId,
      status: mapped.status,
      internalPayload: {
        claim_id: mapped.providerClaimId,
        status: mapped.status,
      },
    };
  }
}

export const defaultYandexClaimsAcceptService = new YandexClaimsAcceptService();
