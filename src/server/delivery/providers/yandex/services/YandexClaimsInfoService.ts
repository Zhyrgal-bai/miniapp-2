import { createYandexHttpClient, type YandexHttpFetch } from "../client/yandexHttpClient.js";
import type { YandexClaimsInfoResponseBody } from "../dto/yandexClaimsInfoDto.js";
import {
  mapClaimsInfoResponse,
  mockClaimsInfoResponse,
  type YandexClaimSnapshot,
} from "../adapters/yandexClaimsInfoAdapter.js";
import {
  isYandexDeliveryConfigured,
  isYandexDeliveryMockEnabled,
  loadYandexDeliveryConfig,
} from "./yandexDeliveryConfig.js";

export type YandexClaimsInfoFailure = {
  ok: false;
  code:
    | "validation_error"
    | "timeout"
    | "network_error"
    | "rate_limited"
    | "api_error"
    | "not_configured";
  error: string;
};

export type YandexClaimsInfoResult =
  | { ok: true; snapshot: YandexClaimSnapshot }
  | YandexClaimsInfoFailure;

export class YandexClaimsInfoService {
  async getClaimInfo(
    claimId: string,
    options?: {
      fetchImpl?: YandexHttpFetch;
      fallbackUpdatedAt?: Date;
      mockStatus?: string;
    },
  ): Promise<YandexClaimsInfoResult> {
    const id = claimId.trim();
    if (id === "") {
      return { ok: false, code: "validation_error", error: "claimId is required" };
    }

    if (!isYandexDeliveryConfigured()) {
      return { ok: false, code: "not_configured", error: "Yandex Delivery is not configured" };
    }

    const fallbackUpdatedAt = options?.fallbackUpdatedAt ?? new Date();

    if (isYandexDeliveryMockEnabled()) {
      const status = options?.mockStatus ?? "performer_found";
      return {
        ok: true,
        snapshot: mockClaimsInfoResponse(id, status, fallbackUpdatedAt),
      };
    }

    const config = loadYandexDeliveryConfig();
    const client = createYandexHttpClient(config, {
      ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    const infoPath = `${config.claimsInfoPath}?claim_id=${encodeURIComponent(id)}`;
    const httpResult = await client.post<YandexClaimsInfoResponseBody>(
      infoPath,
      { claim_id: id },
    );

    if (!httpResult.ok) {
      if (httpResult.kind === "timeout") {
        return { ok: false, code: "timeout", error: httpResult.error };
      }
      if (httpResult.kind === "network") {
        return { ok: false, code: "network_error", error: httpResult.error };
      }
      if (httpResult.status === 429) {
        return { ok: false, code: "rate_limited", error: httpResult.error };
      }
      return { ok: false, code: "api_error", error: httpResult.error };
    }

    const snapshot = mapClaimsInfoResponse(httpResult.data, fallbackUpdatedAt);
    if (!snapshot) {
      return { ok: false, code: "api_error", error: "claims/info returned no status" };
    }

    return { ok: true, snapshot };
  }
}

export const defaultYandexClaimsInfoService = new YandexClaimsInfoService();
