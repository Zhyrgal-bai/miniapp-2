import { createYandexHttpClient, type YandexHttpFetch } from "../client/yandexHttpClient.js";
import type { YandexClaimsCreateResponseBody } from "../dto/yandexClaimsDto.js";
import {
  buildYandexClaimsCreateRequest,
  mapClaimsApiError,
  mapClaimsCreateResponse,
  mockClaimsCreateResponse,
  validateClaimsCreateInput,
  type YandexClaimsCreateInput,
  type YandexClaimsCreateResult,
} from "../adapters/yandexClaimsAdapter.js";
import {
  isYandexDeliveryConfigured,
  isYandexDeliveryMockEnabled,
  loadYandexDeliveryConfig,
} from "./yandexDeliveryConfig.js";
import { logDeliveryClaimCreate } from "../utils/yandexClaimsLogging.js";

function parseErrorBody(raw: string | undefined): { code?: string; message?: string } {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as { code?: string; message?: string };
  } catch {
    return {};
  }
}

export type YandexClaimsCreateServiceContext = {
  merchantId: number;
  orderId: number;
  requestId?: string;
  correlationId?: string;
};

export class YandexClaimsCreateService {
  async create(
    input: YandexClaimsCreateInput,
    ctx: YandexClaimsCreateServiceContext,
    options?: { fetchImpl?: YandexHttpFetch },
  ): Promise<YandexClaimsCreateResult> {
    const started = Date.now();
    const logBase = {
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      provider: "yandex" as const,
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
    };

    const validationError = validateClaimsCreateInput(input);
    if (validationError) {
      logDeliveryClaimCreate({
        ...logBase,
        durationMs: Date.now() - started,
        ok: false,
        code: "validation_error",
      });
      return { ok: false, code: "validation_error", error: validationError };
    }

    if (!isYandexDeliveryConfigured()) {
      logDeliveryClaimCreate({
        ...logBase,
        durationMs: Date.now() - started,
        ok: false,
        code: "not_configured",
      });
      return {
        ok: false,
        code: "not_configured",
        error: "Yandex Delivery is not configured",
      };
    }

    if (isYandexDeliveryMockEnabled()) {
      const mock = mockClaimsCreateResponse(input);
      logDeliveryClaimCreate({
        ...logBase,
        durationMs: Date.now() - started,
        ok: true,
        status: "new",
      });
      return mock;
    }

    const config = loadYandexDeliveryConfig();
    const client = createYandexHttpClient(config, {
      ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    const body = buildYandexClaimsCreateRequest(input);

    const httpResult = await client.post<YandexClaimsCreateResponseBody>(
      config.claimsCreatePath,
      body,
      {
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
      },
    );

    if (!httpResult.ok) {
      if (httpResult.kind === "timeout") {
        logDeliveryClaimCreate({
          ...logBase,
          durationMs: httpResult.durationMs,
          ok: false,
          code: "timeout",
        });
        return { ok: false, code: "timeout", error: httpResult.error };
      }
      if (httpResult.kind === "network") {
        logDeliveryClaimCreate({
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
        logDeliveryClaimCreate({
          ...logBase,
          durationMs: httpResult.durationMs,
          ok: false,
          code: failure.code,
          httpStatus: httpResult.status,
        });
        return failure;
      }
      logDeliveryClaimCreate({
        ...logBase,
        durationMs: httpResult.durationMs,
        ok: false,
        code: "api_error",
      });
      return { ok: false, code: "api_error", error: httpResult.error };
    }

    const mapped = mapClaimsCreateResponse(httpResult.data);
    if (!mapped) {
      logDeliveryClaimCreate({
        ...logBase,
        durationMs: httpResult.durationMs,
        ok: false,
        code: "api_error",
      });
      return {
        ok: false,
        code: "api_error",
        error: "Yandex claims/create returned no claim id",
      };
    }

    logDeliveryClaimCreate({
      ...logBase,
      durationMs: httpResult.durationMs,
      ok: true,
      status: mapped.status,
    });

    return {
      ok: true,
      providerClaimId: mapped.providerClaimId,
      internalPayload: {
        claim_id: mapped.providerClaimId,
        status: mapped.status,
      },
    };
  }
}

export const defaultYandexClaimsCreateService = new YandexClaimsCreateService();
